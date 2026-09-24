import { DataSource } from 'typeorm';
import { AppDataSource } from '../src/data-source';
import { UserEntity } from '../src/users/user.entity';

describe('Database schema (e2e)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await AppDataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('persists a user and enforces unique telegram_id', async () => {
    const repo = dataSource.getRepository(UserEntity);
    const user = await repo.save(repo.create({ telegramId: '9999001' }));
    expect(user.id).toBeDefined();

    await expect(repo.save(repo.create({ telegramId: '9999001' }))).rejects.toThrow();

    await repo.delete({ telegramId: '9999001' });
  });
});
