import { databaseOptions } from './database';
describe('SQL Server configuration', () => {
  const ado =
    'Server=localhost,1433;Database=handsets;User Id=app;Password=secret;Encrypt=true;TrustServerCertificate=true';
  it('parses equivalent URL and ADO formats', () => {
    expect(
      databaseOptions({
        DATABASE_URL:
          'mssql://app:secret@localhost:1433/handsets?encrypt=true&trustServerCertificate=true',
      }),
    ).toEqual(databaseOptions({ DATABASE_URL: ado }));
  });
  it('decodes URL credentials exactly once', () => {
    const password = 'p@ss:;/+?#%25 ü';
    const options = databaseOptions({
      DATABASE_URL:
        'mssql://user%40jazz:' + encodeURIComponent(password) + '@db/handsets',
    });
    expect(options.password).toBe(password);
    expect(options.username).toBe('user@jazz');
    expect(options.options).toMatchObject({
      encrypt: true,
      trustServerCertificate: false,
      useUTC: true,
    });
  });
  it('preserves quoted ADO semicolons, equals signs and escaped quotes', () => {
    expect(
      databaseOptions({
        DATABASE_URL:
          ' Server = tcp:db,1444; DATABASE=db; User Id=user;Password="p;a=""ss";Encrypt=False;TrustServerCertificate=TRUE;',
      }),
    ).toMatchObject({
      host: 'db',
      port: 1444,
      password: 'p;a="ss',
      options: { encrypt: false, trustServerCertificate: true },
    });
  });
  it('supports single-quoted ADO values', () => {
    expect(
      databaseOptions({
        DATABASE_URL: "Server=db;Database=db;User Id=user;Password='a;''b'",
      }).password,
    ).toBe("a;'b");
  });
  it('keeps plus and percent literal in ADO', () => {
    expect(
      databaseOptions({ DATABASE_URL: ado.replace('secret', 'a+b%20=c') })
        .password,
    ).toBe('a+b%20=c');
  });
  it('supports IPv6', () => {
    expect(
      databaseOptions({ DATABASE_URL: 'mssql://u:p@[::1]:1434/db' }).host,
    ).toBe('::1');
    expect(
      databaseOptions({
        DATABASE_URL: 'Server=[::1],1434;Database=db;User Id=u;Password=p',
      }).host,
    ).toBe('::1');
  });
  it('uses migration credentials only for CLI and falls back', () => {
    const env = {
      DATABASE_URL: ado,
      DATABASE_MIGRATION_URL: ado.replace('app', 'migrator'),
    };
    expect(databaseOptions(env).username).toBe('app');
    expect(databaseOptions(env, true).username).toBe('migrator');
    expect(databaseOptions({ DATABASE_URL: ado }, true).username).toBe('app');
  });
  it('applies pool and connection timeout with schema sync always disabled', () => {
    expect(
      databaseOptions({
        DATABASE_URL: ado,
        DB_POOL_MAX: '20',
        DB_CONNECT_TIMEOUT: '30000',
      }),
    ).toMatchObject({
      pool: { max: 20 },
      connectionTimeout: 30000,
      synchronize: false,
      migrationsRun: false,
      entities: [],
    });
  });
  it.each([
    '',
    'postgres://u:p@host/db',
    'mssql://u:p@host',
    'mssql://u:p@host/db#secret',
    'mssql://u:%GG@host/db',
    'mssql://u:p@host:99999/db',
    'mssql://u:p@host/db?encrypt=yes',
    'mssql://u:p@host/db?encrypt=true&encrypt=false',
    'mssql://u:p@host/db?unknown=true',
    'Server=db;Database=db;User Id=u',
    'Server=db;Database=db;User Id=u;Password="unclosed',
    'Server=db;Database=db;User Id=u;Password=p;Password=q',
    'Server=db;Database=db;User Id=u;Password=p;Unknown=x',
  ])('rejects invalid input without revealing it', (value) => {
    expect(() => databaseOptions({ DATABASE_URL: value })).toThrow(
      'Invalid database configuration; check connection format and options',
    );
  });
  it.each(['0', '-1', 'NaN', '', '1.2', '2e2'])(
    'rejects invalid numeric settings %s',
    (value) => {
      expect(() =>
        databaseOptions({ DATABASE_URL: ado, DB_POOL_MAX: value }),
      ).toThrow();
      expect(() =>
        databaseOptions({ DATABASE_URL: ado, DB_CONNECT_TIMEOUT: value }),
      ).toThrow();
    },
  );
});
