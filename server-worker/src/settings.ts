import {settingsInput} from '../../shared/settings-input';
import {libraryRules} from '../../shared/library-rules';
import { stmt } from './db';
import { fail } from './http';
import type { Env } from './types';
export function saveSettings(env:Env,values:Record<string,unknown>){return Object.entries(settingsInput(values)).map(([key,value])=>stmt(env.DB,'INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at',key,JSON.stringify(value),Date.now()));}
