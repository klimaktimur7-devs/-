import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import {
  GiftResolverClient,
  GiftNotFoundError,
  GiftResolverTimeoutError,
  GiftResolverUnavailableError,
} from './gift-resolver.client';

jest.mock('child_process');
const execFileMock = execFile as unknown as jest.Mock;

describe('GiftResolverClient', () => {
  const configService = { get: jest.fn() } as unknown as ConfigService;
  const client = new GiftResolverClient(configService);

  beforeEach(() => jest.clearAllMocks());

  it('parses a successful resolution', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, callback) => {
      callback(
        null,
        JSON.stringify({
          name: 'Vice Cream',
          editionNumber: 33564,
          model: 'Vanilla',
          symbol: 'Pickaxe',
          backdropName: 'Camo Green',
          backdropColor: '#75944d',
          imageUrl: '/gift-assets/ViceCream-33564.jpg',
          telegramSlug: 'ViceCream-33564',
        }),
        '',
      );
    });

    const result = await client.resolve('ViceCream-33564');
    expect(result.name).toBe('Vice Cream');
    expect(result.backdropColor).toBe('#75944d');
  });

  it('throws GiftNotFoundError when the script reports gift_not_found', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, callback) => {
      callback(new Error('exit 1'), '', JSON.stringify({ error: 'gift_not_found' }));
    });

    await expect(client.resolve('bad-slug')).rejects.toBeInstanceOf(GiftNotFoundError);
  });

  it('throws GiftResolverUnavailableError on an unparseable/unexpected failure', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, callback) => {
      callback(new Error('boom'), '', 'not json');
    });

    await expect(client.resolve('slug')).rejects.toBeInstanceOf(GiftResolverUnavailableError);
  });

  it('throws GiftResolverTimeoutError when the process is killed by the timeout', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, callback) => {
      callback(Object.assign(new Error('timeout'), { killed: true }));
    });

    await expect(client.resolve('slug')).rejects.toBeInstanceOf(GiftResolverTimeoutError);
  });
});
