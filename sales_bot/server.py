"""ИИ-продавец сайтов: сервер для теста голосом в браузере.

Запуск:  uvicorn server:app --port 8000   (из папки sales_bot)
Открыть: http://localhost:8000
"""

import json
import re
import uuid
from datetime import datetime
from pathlib import Path

import yaml
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from llm import make_llm
from prompt import END_MARKER, build_system_prompt, lead_context

BASE = Path(__file__).parent
CALLS_DIR = BASE / "calls"
STOP_LIST = BASE / "do_not_call.txt"
CALLS_DIR.mkdir(exist_ok=True)

CFG = yaml.safe_load((BASE / "config.yaml").read_text(encoding="utf-8"))
SYSTEM = build_system_prompt(CFG)
SORRY = "Вибачте, трохи погано чути. Я передам ваш номер менеджеру, він вам зателефонує. Гарного дня! " + END_MARKER

llm = make_llm(CFG)
app = FastAPI()

# Активные звонки в памяти: id -> {"lead": ..., "messages": [...], "transcript": [...]}
calls: dict[str, dict] = {}


def normalize_phone(phone: str) -> str:
    return re.sub(r"\D", "", phone or "")


def stop_list() -> set[str]:
    if not STOP_LIST.exists():
        return set()
    return {line.strip() for line in STOP_LIST.read_text().splitlines() if line.strip()}


class Lead(BaseModel):
    name: str = ""
    business: str = ""
    city: str = ""
    phone: str = ""
    notes: str = ""


class Turn(BaseModel):
    call_id: str
    text: str


class CallRef(BaseModel):
    call_id: str


@app.get("/")
async def index():
    return FileResponse(BASE / "static" / "index.html")


@app.post("/api/start")
async def start(lead: Lead):
    phone = normalize_phone(lead.phone)
    if phone and phone in stop_list():
        raise HTTPException(403, "Этот номер в стоп-листе: человек просил больше не звонить.")
    call_id = uuid.uuid4().hex[:12]
    calls[call_id] = {"lead": lead.model_dump(), "messages": [], "transcript": [],
                      "started": datetime.now().isoformat(timespec="seconds")}
    return {"call_id": call_id}


@app.post("/api/turn")
async def turn(t: Turn):
    call = calls.get(t.call_id)
    if not call:
        raise HTTPException(404, "Звонок не найден")

    text = t.text.strip() or "(мовчання)"
    if not call["messages"]:
        text = f"{lead_context(call['lead'])} «{text}»"
    call["messages"].append({"role": "user", "content": text})
    call["transcript"].append({"who": "client", "text": t.text.strip()})

    async def generate():
        spoken = ""
        try:
            async for chunk in llm.reply(SYSTEM, call["messages"], SORRY):
                spoken += chunk
                yield chunk
        except Exception as e:  # звонок не должен падать: извиняемся и завершаем
            print(f"LLM error: {e!r}")
            spoken = SORRY
            yield SORRY
            if call["messages"][-1]["role"] == "user":
                call["messages"].pop()  # чтобы история не сломалась на следующем ходе
        call["transcript"].append({"who": "bot", "text": spoken.replace(END_MARKER, "").strip()})

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")


SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "outcome": {
            "type": "string",
            "enum": ["consultation_booked", "interested", "callback_later",
                     "not_interested", "do_not_call", "unclear"],
        },
        "client_name": {"type": "string"},
        "business": {"type": "string"},
        "has_website": {"type": "string"},
        "recommended_package": {"type": "string"},
        "objections": {"type": "array", "items": {"type": "string"}},
        "next_step": {"type": "string"},
        "callback_time": {"type": "string"},
        "summary": {"type": "string"},
    },
    "required": ["outcome", "client_name", "business", "has_website", "recommended_package",
                 "objections", "next_step", "callback_time", "summary"],
    "additionalProperties": False,
}


@app.post("/api/end")
async def end(ref: CallRef):
    call = calls.pop(ref.call_id, None)
    if not call:
        raise HTTPException(404, "Звонок не найден")

    dialog = "\n".join(
        f"{'Клієнт' if m['who'] == 'client' else 'Асистент'}: {m['text']}" for m in call["transcript"]
    )
    result = {"outcome": "unclear", "summary": "Не удалось составить итог."}
    if call["transcript"]:
        try:
            result = await llm.json(
                "Ось розшифровка дзвінка з продажу сайтів. Склади підсумок російською мовою. "
                "Якщо поля не відомі — пиши порожній рядок. outcome=do_not_call, якщо людина "
                f"просила більше не дзвонити.\n\n{dialog}",
                SUMMARY_SCHEMA,
            )
        except Exception as e:
            print(f"Summary error: {e!r}")

    phone = normalize_phone(call["lead"]["phone"])
    if result.get("outcome") == "do_not_call" and phone:
        with STOP_LIST.open("a") as f:
            f.write(phone + "\n")

    record = {"started": call["started"], "lead": call["lead"], "result": result,
              "transcript": call["transcript"]}
    name = f"{call['started'].replace(':', '-')}_{ref.call_id}.json"
    (CALLS_DIR / name).write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    return record
