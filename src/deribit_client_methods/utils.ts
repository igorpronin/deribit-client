import { RpcError, RpcMessage } from '../types/types';
import { DeribitClient } from '../DeribitClient';
import { remove_elements_from_existing_array } from '@igorpronin/utils';
import { re_auth } from './auth_requests_and_handlers';

export function to_console(context: DeribitClient, msg: string, error?: RpcError | RpcMessage) {
  if (error) {
    console.error(error);
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
  remove_elements_from_existing_array(context.obligatory_data_pending, id);
  if (!context.obligatory_data_received.includes(id)) {
    context.obligatory_data_received.push(id);
  }
  if (context.obligatory_data_pending.length === 0) {
    context.ee.emit('all_obligatory_data_received');
  }
}

export function validate_user_requests(context: DeribitClient) {
  let no_indexes = !context.indexes || context.indexes.length === 0;
  let no_instruments = !context.instruments || context.instruments.length === 0;
  to_console(
    context,
    `No indexes or instruments to monitor or trade, add one or both of the options: indexes or instruments`,
  );
  if (no_indexes && no_instruments) {
    throw new Error('No indexes or instruments to monitor or trade');
  }
}
