// @ts-expect-error The package is deliberately not installed.
import { chromium } from 'playwright';

export const engine = chromium;
