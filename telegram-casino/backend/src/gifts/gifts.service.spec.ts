import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GiftsService, DuplicateGiftSlugError } from './gifts.service';
import { GiftEntity } from './gift.entity';

describe('GiftsService', () => {
  let service: GiftsService;
  const repoMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => ({ id: 'generated-id', ...data })),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [GiftsService, { provide: getRepositoryToken(GiftEntity), useValue: repoMock }],
    }).compile();
    service = moduleRef.get(GiftsService);
  });

  const validInput = {
    editionNumber: 33564,
    name: 'Vice Cream',
    model: 'Vanilla',
    symbol: 'Pickaxe',
    backdropName: 'Camo Green',
    backdropColor: '#75944d',
    imageUrl: '/gift-assets/ViceCream-33564.jpg',
    telegramSlug: 'ViceCream-33564',
    priceTon: '150',
  };

  it('creates a gift', async () => {
    const gift = await service.create(validInput);
    expect(gift.id).toBe('generated-id');
    expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({ telegramSlug: 'ViceCream-33564' }));
  });

  it('throws DuplicateGiftSlugError when the slug already exists', async () => {
    repoMock.save.mockRejectedValueOnce({ code: '23505' });
    await expect(service.create(validInput)).rejects.toBeInstanceOf(DuplicateGiftSlugError);
  });

  it('lists only non-deleted gifts', async () => {
    repoMock.find.mockResolvedValue([{ id: '1' }]);
    const gifts = await service.findAllActive();
    expect(gifts).toEqual([{ id: '1' }]);
    expect(repoMock.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: expect.anything() }) }),
    );
  });

  it('updates an existing gift', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'gift-1', priceTon: '100' });
    const updated = await service.update('gift-1', { priceTon: '200' });
    expect(updated.priceTon).toBe('200');
  });

  it('throws NotFoundException when updating a missing gift', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await expect(service.update('missing', { priceTon: '200' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-deletes a gift by setting deletedAt', async () => {
    repoMock.update.mockResolvedValue({ affected: 1 });
    await service.softDelete('gift-1');
    expect(repoMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'gift-1' }),
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
  });

  it('throws NotFoundException when soft-deleting an already-deleted or missing gift', async () => {
    repoMock.update.mockResolvedValue({ affected: 0 });
    await expect(service.softDelete('gone')).rejects.toBeInstanceOf(NotFoundException);
  });
});
