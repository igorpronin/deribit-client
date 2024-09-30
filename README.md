# Deribit client

Deribit client for internal purposes

> **Warning**: This package is currently in active development and is not recommended for production use.

## Install

```npm i @igorpronin/deribit-client```

## Usage

```typescript
import {
  DeribitClient,
  Currencies,
  Indexes,
  Kinds,
} from '@igorpronin/deribit-client';

const client = new DeribitClient({
  api_env: 'prod',
  api_key: 'YOUR_DERIBIT_API_KEY',
  client_id: 'YOUR_DERIBIT_CLIENT_ID',
  output_console: true, // optional, defaults to true
  
  // at least one of two options (indexes or instruments) required and shouldn't be empty:
  indexes: [Indexes.BtcUsd, Indexes.EthUsd], // optional
  instruments: ['BTC-PERPETUAL', 'ETH-PERPETUAL'], // optional

  on_open: () => console.log('WebSocket opened'),
  on_close: () => console.log('WebSocket closed'),
  on_error: (error) => console.error('WebSocket error:', error),
  on_message: (msg) => console.log('Received message:', msg),
});
```

## Open orders

```typescript
// Example of opening an order
const order_params = {
  instrument_name: 'BTC-PERPETUAL',
  amount: 100,
  type: 'limit',
  price: 50000,
  post_only: true,
  // Add other necessary parameters
};

const order_id = client.process_open_order(order_params);
console.log('New order ID:', order_id);
```

## Events

```typescript
client.ee.on('authorized', () => console.log('Authorized!'));  
client.ee.on('subscribed', (msg: any) => console.log('Subscribed!', msg));
client.ee.on('subscribed_all', () => console.log('Subscribed all!'));
client.ee.on('portfolio_updated', (ticker: Currencies) => console.log('Portfolio updated!', ticker));
client.ee.on('position_updated', (instrument_name: string) => console.log('Position updated!', instrument_name));
client.ee.on('index_updated', (pair: Indexes) => console.log('Index updated!', pair));
client.ee.on('ticker_updated', (instrument_name: string) => console.log('Ticker updated!', instrument_name));
client.ee.on('portfolio_updated', () => {
  const acc_summary = client.get_accounts_summary();
  console.log(acc_summary);
});
```

## Public Methods

#### get_configuration()
Returns the current configuration of the client.

#### get_index(index: Indexes)
Returns the current index price for the specified currency pair.

#### get_pending_subscriptions()
Returns an array of pending subscriptions.

#### get_active_subscriptions()
Returns an array of active subscriptions.

#### get_account_summaries()
Returns summaries of all accounts.

#### get_deribit_instruments(kind: Kinds)
Returns the instruments for the specified kind.

#### get_deribit_instrument_by_name(instrument_name: string)
Returns the instrument for the specified name.

#### get_deribit_currencies_list()
Returns the list of currencies supported by Deribit.

#### get_ticker_data(instrument_name: string)
Returns the full ticker data (raw and calculated) for the specified instrument.

#### get_raw_ticker_data(instrument_name: string)
Returns the raw ticker data for the specified instrument.

#### get_calculated_ticker_data(instrument_name: string)
Returns the calculated ticker data for the specified instrument.

#### get_positions()
Returns all positions.

#### get_position_by_instrument_name(instrument_name: string)
Returns the position for the specified instrument.

#### has_pending_orders()
Returns a boolean indicating whether there are any pending orders.

#### process_open_order(params: OrderParams)
Opens a new order with the specified parameters.

## Contacts

Any questions? DM me: [@igorpronin](https://t.me/igorpronin)

## License

MIT License

Copyright (c) 2024 Igor Pronin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

