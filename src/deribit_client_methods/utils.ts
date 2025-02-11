import { RpcError, RpcMessage, ScopeTitle, Scope } from '../types/types';
import { DeribitClient } from '../DeribitClient';
import { remove_elements_from_existing_array } from '@igorpronin/utils';
import { re_auth } from './auth_requests_and_handlers';
import { obligatory_subscriptions } from './actions';

export function to_console(
  context: DeribitClient,
  msg: string,
  error?: RpcError | RpcMessage | boolean,
) {
  if (error) {
    console.error(`${context.msg_prefix} ${msg}`);
    if (typeof error !== 'boolean') {
      console.error('Error:');
      console.error(error);
    }
  }
  if (!context.output_console) {
    return;
  }
  if (!error) {
    console.log(`${context.msg_prefix} ${msg}`);
  }
}

export function count_refresh(context: DeribitClient): any {
  return setInterval(() => {
    context.refresh_counter++;
    handle_refresh_counter(context);
  }, 1000);
}

export function handle_refresh_counter(context: DeribitClient) {
  if (context.refresh_counter === context.refresh_interval) {
    clearInterval(context.refresh_counter_id);
    context.refresh_counter = 0;
    re_auth(context);
  }
}

export function is_instruments_list_ready(context: DeribitClient) {
  return (
    context.obligatory_data_received.includes('get_instruments/future') &&
    context.obligatory_data_received.includes('get_instruments/option') &&
    context.obligatory_data_received.includes('get_instruments/spot')
  );
}

// export function validate_if_instance_is_ready(context: DeribitClient) {
//   const previous_state = context.is_instance_ready;
//   context.is_instance_ready =
//     context.subscriptions_pending.length === 0 && context.obligatory_data_pending.length === 0;
//   const new_state = context.is_instance_ready;
//   if (previous_state !== new_state && new_state) {
//     context.ee.emit('instance_ready');
//   }
// }

export function init_pending_subscriptions_check(context: DeribitClient) {
  setTimeout(() => {
    if (context.subscriptions_pending.length) {
      let m = 'WARNING! Pending subscriptions still exist';
      context.subscriptions_pending.forEach((s: string) => {
        m += `\n   ${s}`;
      });
      to_console(context, m);
    }
  }, context.subscriptions_check_time * 1000);
}

export function hadle_opligatory_data_status(context: DeribitClient, id: string) {
  if (context.is_obligatory_data_received) {
    return;
  }
  remove_elements_from_existing_array(context.obligatory_data_pending, id);
  if (!context.obligatory_data_received.includes(id)) {
    context.obligatory_data_received.push(id);
  }
  if (context.obligatory_data_pending.length === 0 && !context.is_obligatory_data_received) {
    context.is_obligatory_data_received = true;
    context.ee.emit('all_obligatory_data_received');
  }
}

export function validate_user_requests(context: DeribitClient) {
  let no_indexes = !context.indexes || context.indexes.length === 0;
  let no_instruments = !context.instruments || context.instruments.length === 0;
  if (no_indexes && no_instruments) {
    to_console(
      context,
      `No indexes or instruments to monitor or trade, add one or both of the options: indexes or instruments`,
    );
    throw new Error('No indexes or instruments to monitor or trade');
  }
}

export function process_scope(context: DeribitClient, scope: string) {
  const items = scope.split(' ');
  items.forEach((item) => {
    const parts = item.split(':');
    context.auth_data.scope.processed[parts[0] as ScopeTitle] = parts[1] as Scope;
    if (parts[0] === 'trade') {
      context.auth_data.trade_permit = parts[1] === 'read_write';
    }
  });
}

export function validate_auth_and_trade_permit(context: DeribitClient) {
  if (!context.auth_data.state) {
    throw new Error('Not authorized');
  }
  if (context.readonly) {
    throw new Error('Instance is in readonly mode');
  }
  if (!context.auth_data.trade_permit) {
    throw new Error('Trade "read_write" scope is not granted');
  }
}

export function validate_obligatory_subscriptions(context: DeribitClient) {
  obligatory_subscriptions.forEach((subscription) => {
    if (!context.subscriptions_active.includes(`s/${subscription}`)) {
      throw new Error(`Obligatory subscription ${subscription} is not active`);
    }
  });
}
