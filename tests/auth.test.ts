import dotenv from 'dotenv';
dotenv.config();

import { DeribitClient } from '../src/index';

const api_key = process.env.DERIBIT_API_KEY;
const client_id = process.env.DERIBIT_API_CLIENT_ID;

const client = new DeribitClient({
  api_env: 'prod',
  api_key: api_key as string,
  client_id: client_id as string,
  on_message: (msg) => {},
});

const description = `
1 second after start:
- client.authorized_at should be not null,
- an instance of Date should be set,
- auth_data properties should be set correctly,
`;
test(description, async () => {
  // Wait for 1 second
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Check if client.authorized_at is not null
  expect(client['authorized_at']).not.toBeNull();

  // Check if client.authorized_at is an instance of Date
  expect(client['authorized_at']).toBeInstanceOf(Date);

  // Check if auth_data properties are not null or false
  expect(client['auth_data'].state).toBe(true);
  expect(client['auth_data'].refresh_token).not.toBeNull();
  expect(client['auth_data'].access_token).not.toBeNull();
  expect(client['auth_data'].expires_in).not.toBeNull();
  expect(client['auth_data'].scope.raw).not.toBeNull();
});
