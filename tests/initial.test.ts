import dotenv from 'dotenv';
dotenv.config();

import { DeribitClient } from '../src/connection';

describe('DeribitClient', () => {
  it('should be defined', () => {
    expect(DeribitClient).toBeDefined();
  });
});
