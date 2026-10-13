import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { applicationDatabaseOptions } from './options';
export default new DataSource(applicationDatabaseOptions(process.env, true));
