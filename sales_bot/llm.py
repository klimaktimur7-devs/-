"""Подключение к нейросети. Провайдер выбирается в config.yaml → provider.

- gemini / groq / openrouter — у них есть бесплатные лимиты, работают через
  OpenAI-совместимый API (библиотека openai, но это не ChatGPT).
- claude — платный, но самый качественный.
"""

import json
import os

import anthropic
from openai import AsyncOpenAI


class ClaudeLLM:
    FALLBACK_BETA = "server-side-fallback-2026-07-01"

    def __init__(self, cfg: dict):
        self.model = cfg["model"]
        self.effort = cfg.get("effort", "low")
        self.client = anthropic.AsyncAnthropic()

    def _params(self, effort: str) -> dict:
        """Haiku не поддерживает effort; серверный фоллбэк нужен только старшим моделям."""
        params = {"model": self.model}
        if not self.model.startswith("claude-haiku"):
            params["output_config"] = {"effort": effort}
        if self.model.startswith(("claude-opus", "claude-fable")):
            params |= {"betas": [self.FALLBACK_BETA], "fallbacks": "default"}
        return params

    async def reply(self, system: str, messages: list, sorry: str):
        """Стримит ответ по кускам и сам дописывает его в messages."""
        async with self.client.beta.messages.stream(
            **self._params(self.effort), max_tokens=2000, system=system, messages=messages,
        ) as stream:
            async for chunk in stream.text_stream:
                yield chunk
            final = await stream.get_final_message()
        if final.stop_reason == "refusal":
            yield "\n" + sorry
            messages.append({"role": "assistant", "content": sorry})
            return
        # Текст и блоки размышлений сохраняем как есть — так модель помнит ход разговора.
        keep = [b.model_dump(exclude_none=True) for b in final.content
                if b.type in ("text", "thinking", "redacted_thinking")]
        messages.append({"role": "assistant", "content": keep or "…"})

    async def json(self, prompt: str, schema: dict) -> dict:
        params = self._params("low")
        params.setdefault("output_config", {})["format"] = {"type": "json_schema", "schema": schema}
        resp = await self.client.beta.messages.create(
            **params, max_tokens=4000, messages=[{"role": "user", "content": prompt}],
        )
        if resp.stop_reason == "refusal":
            raise RuntimeError("refusal")
        return json.loads(next(b.text for b in resp.content if b.type == "text"))


class OpenAICompatLLM:
    def __init__(self, cfg: dict, provider: dict):
        key = os.environ.get(provider["key_env"])
        if not key:
            raise SystemExit(f"Нет ключа: задай переменную окружения {provider['key_env']} (см. README).")
        self.model = provider["model"]
        self.client = AsyncOpenAI(base_url=provider["base_url"], api_key=key)

    async def reply(self, system: str, messages: list, sorry: str):
        stream = await self.client.chat.completions.create(
            model=self.model, stream=True, temperature=0.7, max_tokens=400,
            messages=[{"role": "system", "content": system}, *messages],
        )
        text = ""
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                text += delta
                yield delta
        messages.append({"role": "assistant", "content": text or sorry})

    async def json(self, prompt: str, schema: dict) -> dict:
        resp = await self.client.chat.completions.create(
            model=self.model, temperature=0,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content":
                       f"{prompt}\n\nОтветь ТОЛЬКО JSON-объектом по этой схеме:\n"
                       f"{json.dumps(schema, ensure_ascii=False)}"}],
        )
        text = resp.choices[0].message.content.strip()
        text = text.removeprefix("```json").removeprefix("```").removesuffix("```")
        return json.loads(text)


def make_llm(cfg: dict):
    name = cfg["provider"]
    if name == "claude":
        return ClaudeLLM(cfg["providers"]["claude"])
    return OpenAICompatLLM(cfg, cfg["providers"][name])
