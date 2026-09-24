import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { GiftEntity } from './gift.entity';

export interface CreateGiftInput {
  editionNumber: number;
  name: string;
  model: string;
  symbol: string;
  backdropName: string;
  backdropColor: string;
  imageUrl: string | null;
  telegramSlug: string;
  priceTon: number | string;
}

export type UpdateGiftInput = Partial<CreateGiftInput>;

export class DuplicateGiftSlugError extends Error {}

@Injectable()
export class GiftsService {
  constructor(
    @InjectRepository(GiftEntity)
    private readonly giftsRepository: Repository<GiftEntity>,
  ) {}

  async findAllActive(): Promise<GiftEntity[]> {
    return this.giftsRepository.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async create(input: CreateGiftInput): Promise<GiftEntity> {
    try {
      return await this.giftsRepository.save(
        this.giftsRepository.create({ ...input, priceTon: String(input.priceTon) }),
      );
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new DuplicateGiftSlugError(`Gift with slug ${input.telegramSlug} already exists`);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateGiftInput): Promise<GiftEntity> {
    const gift = await this.giftsRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!gift) throw new NotFoundException('Gift not found');
    Object.assign(gift, input);
    return this.giftsRepository.save(gift);
  }

  async softDelete(id: string): Promise<void> {
    const result = await this.giftsRepository.update({ id, deletedAt: IsNull() }, { deletedAt: new Date() });
    if (result.affected === 0) throw new NotFoundException('Gift not found');
  }
}
