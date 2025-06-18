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
  Kinds,
} from '@igorpronin/deribit-client';

// WebSocket client usage example
// BTC-PERPETUAL - future contract format
// BTC_USDC - spot format
const client = new DeribitClient({
  api_env: 'prod',
  api_key: 'YOUR_DERIBIT_API_KEY',
  client_id: 'YOUR_DERIBIT_CLIENT_ID',
  instance_id: 'YOUR_INSTANCE_ID', // optional
  output_console: true, // optional, defaults to true
  silent_reauth: false, // optional, defaults to true, if true, re-authorisation will not be shown in the console
  readonly: true, // optional, defaults to false
  reconnect: true, // optional, defaults to true
  fetch_transactions_log_from: '2024-12-13 00:00:00', // optional, ISO 8601 format (YYYY-MM-DD HH:mm:ss or YYYY-MM-DD or other ISO 8601 format values)
  track_transactions_log: true, // optional, defaults to false
  
  // at least one of two options (indexes or instruments) required and shouldn't be empty:
  indexes: ['eth_usd', 'btc_usd'], // optional
  instruments: ['BTC-PERPETUAL', 'ETH-PERPETUAL', 'BTC_USDC'], // optional
  instruments_with_orderbook: true, // optional, defaults to false

  on_open: () => console.log('WebSocket opened'), // optional
  on_close: () => console.log('WebSocket closed'), // optional
  on_error: (error) => console.error('WebSocket error:', error), // optional
  on_message: (msg) => console.log('Received message:', msg), // required
});

// HTTP client usage example (only public methods yet, dev in progress)
const http_client = new DeribitClientHTTP({ api_env: 'prod' });
// Currencies: 'BTC' | 'ETH' | 'USDC' | 'USDT' | 'EURR' | 'any'
// Kinds: 'future' | 'option' | 'spot' | 'future_combo' | 'option_combo'
http_client.get_instruments_list('BTC', 'option').then(console.log);
```

## Open orders

```typescript
// Example of opening an order
const order_params = {
  instrument_name: 'BTC-PERPETUAL',
  amount: 100,
  type: OrderType.limit,
  price: 50000,
  time_in_force: TimeInForce.GTC,
  direction: 'buy',
};

const { id, msg } = client.process_open_order(order_params);
console.log('New order ID:', id);
```

## Events

```typescript
client.ee.on('authorized', () => console.log('Authorized!'));  
client.ee.once('authorized', () => console.log('Authorized!'));  
client.ee.on('subscribed', (msg: any) => console.log('Subscribed!', msg));
client.ee.on('subscribed_all', () => console.log('Subscribed all!'));
client.ee.on('portfolio_updated', (ticker: Currencies) => console.log('Portfolio updated!', ticker));
client.ee.on('position_updated', (instrument_name: string) => console.log('Position updated!', instrument_name));
client.ee.on('index_updated', (pair: Indexes) => console.log('Index updated!', pair));
client.ee.once('index_updated', (pair: Indexes) => console.log('Index updated!', pair));
client.ee.on('ticker_updated', (instrument_name: string) => console.log('Ticker updated!', instrument_name));
client.ee.once('ticker_updated', (instrument_name: string) => console.log('Ticker updated!', instrument_name));
client.ee.on('all_obligatory_data_received', () => console.log('All obligatory data received!'));
client.ee.on('order_updated', (order_id: string) => console.log('Order updated!', order_id));
client.ee.on('order_edited', (order_id: string) => console.log('Order edited!', order_id));
client.ee.on('order_filled', (order_id: string) => console.log('Order filled!', order_id));
client.ee.on('account_summaries_updated', () => console.log('Account summaries updated!'));
client.ee.on('trade_processed', (trade_id) => console.log(client.get_trade_by_id(trade_id)));
client.ee.on('disconnected', () => console.log('Disconnected!'));
client.ee.on('book_updated', (instrument_name: string) => console.log('Book updated!', instrument_name));
client.ee.on('order_closed', (order_id: string) => console.log('Order closed!', order_id)); // Closing states: filled, cancelled, rejected
client.ee.on('transaction_log_updated', (currencies: TransactionLogCurrencies[]) => console.log('Transaction log updated!', currencies));
```

## Public Methods

#### get_configuration()
Returns the current configuration of the client.

#### can_trade()
Returns a boolean indicating whether the client can trade.

#### get_index(index: Indexes)
Returns the current index price for the specified currency pair.

#### get_pending_subscriptions()
Returns an array of pending subscriptions.

#### get_active_subscriptions()
Returns an array of active subscriptions.

#### get_obligatory_data_pending()
Returns a boolean indicating whether obligatory data is pending.

#### get_obligatory_data_received()
Returns a boolean indicating whether obligatory data is received.

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

#### get_orders()
Returns all orders.

#### get_order_by_label(label: string)
Returns the order for the specified label.

#### get_trades()
Returns all trades.

#### has_pending_orders()
Returns a boolean indicating whether there are any pending orders.

#### process_open_order(params: OrderParams)
Opens a new order with the specified parameters.

#### process_edit_order_price(params: EditOrderPriceParams)
Edits the price of the specified order.

#### get_transactions_log(currency: TransactionLogCurrencies)
Returns the transaction log for the specified currency.

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

