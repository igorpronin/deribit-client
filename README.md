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
  PrivateSubscriptions,
  Currencies,
} from '@igorpronin/deribit-client';

const client = new DeribitClient({
  api_env: 'prod' as 'prod' | 'test',
  api_key: DERIBIT_API_KEY,
  client_id: DERIBIT_API_CLIENT_ID,
  currencies: [Currencies.BTC, Currencies.USDT],
  instance_id: account.instance_id, // optional
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
client.ee.on('portfolio_updated', (ticker: Currencies) => console.log('Portfolio updated!', ticker));
client.ee.on('index_updated', (pair: Indexes) => console.log('Index updated!', pair));

client.ee.on('portfolio_updated') => {
  const acc_summary = client.get_accounts_summary();
  console.log(acc_summary);
}
```

## Public Methods

### get_pending_subscriptions()
Returns an array of pending subscriptions.

### get_active_subscriptions()
Returns an array of active subscriptions.

### get_accounts_summary()
Returns a summary of all accounts.

### get_portfolio_by_currency(currency: Currencies)
Returns the portfolio for the specified currency.

### has_pending_orders()
Returns a boolean indicating whether there are any pending orders.

### open_order(params: OrderParams)
Opens a new order with the specified parameters.

### get_configuration()
Returns the current configuration of the client.

### get_index(index: Indexes)
Returns the current index price for the specified currency pair.
