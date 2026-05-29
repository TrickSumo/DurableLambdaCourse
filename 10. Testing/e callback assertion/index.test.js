import {
  LocalDurableTestRunner,
  OperationStatus,
  WaitingOperationStatus
} from "@aws/durable-execution-sdk-js-testing";
import { ExecutionStatus, OperationType } from "@aws-sdk/client-lambda";

import { handler } from "./index.js";

let runner;

beforeAll(async () => {
  await LocalDurableTestRunner.setupTestEnvironment({ skipTime: true });
});

afterAll(async () => {
  await LocalDurableTestRunner.teardownTestEnvironment();
});

beforeEach(() => {
  runner = new LocalDurableTestRunner({ handlerFunction: handler });
});

it("returns the expected result", async () => {
  const runPromise = runner.run();

  const callback = runner.getOperation("approval");
  await callback.waitForData(WaitingOperationStatus.SUBMITTED);
  await callback.sendCallbackSuccess(JSON.stringify({ approved: true }));

  const result = await runPromise;

  expect(result.getStatus()).toBe(ExecutionStatus.SUCCEEDED);

  const { approved } = JSON.parse(result.getResult());
  expect(approved).toBe(true);
});