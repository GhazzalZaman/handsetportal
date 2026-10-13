// SQL Server date-only binding in TypeORM uses the Node process calendar.
// Pin database processes to UTC so DATE and datetime2 never inherit workstation TZ.
// Business calendar operations still explicitly use the shared PKT utilities.
process.env.TZ = 'UTC';
