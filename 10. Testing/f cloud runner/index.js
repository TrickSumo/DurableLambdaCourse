import { withDurableExecution } from '@aws/durable-execution-sdk-js';

export const handler = withDurableExecution(async (event, context) => {
  const result = await context.step("step1", () => event.data);
  return result;
});
