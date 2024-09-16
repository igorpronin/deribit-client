# Deribit client

Deribit client for internal purposes

> **Warning**: This package is currently in active development and is not recommended for production use.

## Install

```npm i @igorpronin/deribit-client```

## Usage

```
import {
  DeribitClient,
  PublicSubscriptions,
  PrivateSubscriptions
} from '@igorpronin/deribit-client';

const client = new DeribitClient({
  api_env: 'prod', // 'prod' or 'test'
  api_key: DERIBIT_API_KEY,
  client_id: DERIBIT_API_CLIENT_ID,
  on_message: (msg) => {console.log(msg)},
  subscriptions: [
    PublicSubscriptions.IndexPriceBtcUsd,
    PrivateSubscriptions.PortfolioBtc,
  ]
})
```

## Events

```
client.ee.on('authorized', () => console.log('Authorized!'));  
client.ee.on('subscribed', (msg: any) => console.log('Subscribed!', msg));
client.ee.on('subscribed_all', () => console.log('Subscribed all!'));
```
