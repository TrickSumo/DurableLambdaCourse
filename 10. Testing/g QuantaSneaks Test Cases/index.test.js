import { jest } from "@jest/globals";
import {
  LocalDurableTestRunner,
  OperationStatus,
  WaitingOperationStatus,
} from "@aws/durable-execution-sdk-js-testing";
import { ExecutionStatus, OperationType } from "@aws-sdk/client-lambda";

// Register mock BEFORE handler.js is imported — ESM requires this order.
// The real lib/dynamo.js talks to DynamoDB; the mock below replaces it for tests.
jest.unstable_mockModule("./lib/dynamo.js", () => ({
  updateOrder: jest.fn().mockResolvedValue(undefined),
}));

// Dynamic imports run AFTER the mock is registered, so handler.js
// receives the mock when it resolves its ./lib/dynamo.js dependency.
const { handler } = await import("./index.js");
const { updateOrder } = await import("./lib/dynamo.js");

let runner;

beforeAll(async () => {
  await LocalDurableTestRunner.setupTestEnvironment({ skipTime: true });
});

afterAll(async () => {
  await LocalDurableTestRunner.teardownTestEnvironment();
});

beforeEach(() => {
  runner = new LocalDurableTestRunner({ handlerFunction: handler });
  updateOrder.mockClear();
});

it("ships the order when payment and admin approval both succeed", async () => {
})

// ─── Test 1: Happy path ───────────────────────────────────────────────────────
it("ships the order when payment and admin approval both succeed", async () => {
  const runPromise = runner.run({ payload: { orderId: "order-001" } });

  const payment = runner.getOperation("payment");
  await payment.waitForData(WaitingOperationStatus.SUBMITTED);
  await payment.sendCallbackSuccess(JSON.stringify({ paymentId: "pay-abc" }));

  const adminApproval = runner.getOperation("admin-approval");
  await adminApproval.waitForData(WaitingOperationStatus.SUBMITTED);
  await adminApproval.sendCallbackSuccess(JSON.stringify({}));

  const result = await runPromise;

  expect(result.getStatus()).toBe(ExecutionStatus.SUCCEEDED);
  expect(result.getResult()).toEqual({ orderId: "order-001", status: "shipped" });

  // updateOrder is called for: awaiting_payment, awaiting_approval, shipped
  expect(updateOrder).toHaveBeenCalledTimes(3);
  expect(updateOrder).toHaveBeenCalledWith("order-001", expect.objectContaining({
    status: { S: "awaiting_payment" },
  }));
  expect(updateOrder).toHaveBeenCalledWith("order-001", expect.objectContaining({
    status: { S: "awaiting_approval" },
  }));
  expect(updateOrder).toHaveBeenCalledWith("order-001", expect.objectContaining({
    status: { S: "shipped" },
  }));
});

// // ─── Test 2: Admin rejects → compensation ────────────────────────────────────
it("runs refund-payment compensation and returns compensated when admin rejects", async () => {
  const runPromise = runner.run({ payload: { orderId: "order-002" } });

  const payment = runner.getOperation("payment");
  await payment.waitForData(WaitingOperationStatus.SUBMITTED);
  await payment.sendCallbackSuccess(JSON.stringify({ paymentId: "pay-abc" }));

  const adminApproval = runner.getOperation("admin-approval");
  await adminApproval.waitForData(WaitingOperationStatus.SUBMITTED);
  await adminApproval.sendCallbackFailure(JSON.stringify({ reason: "Admin rejected the order" }));

  const result = await runPromise;

  expect(result.getStatus()).toBe(ExecutionStatus.SUCCEEDED);
  expect(result.getResult()).toEqual({ orderId: "order-002", status: "compensated" });

  // Refund runs because payment had already succeeded
  const refund = runner.getOperation("refund-payment");
  expect(refund.getType()).toBe(OperationType.STEP);
  expect(refund.getStatus()).toBe(OperationStatus.SUCCEEDED);

  // Final compensate step marks the order as compensated in DB
  const compensate = runner.getOperation("compensate");
  expect(compensate.getType()).toBe(OperationType.STEP);
  expect(compensate.getStatus()).toBe(OperationStatus.SUCCEEDED);

  expect(updateOrder).toHaveBeenCalledWith("order-002", expect.objectContaining({
    status: { S: "compensated" },
  }));
});

// // ─── Test 3: Payment times out → compensated, no refund ──────────────────────
it("returns compensated when payment times out — skips refund since payment never occurred", async () => {
  const runPromise = runner.run({ payload: { orderId: "order-003" } });

  const payment = runner.getOperation("payment");
  await payment.waitForData(WaitingOperationStatus.SUBMITTED);
  await payment.sendCallbackFailure(JSON.stringify({ reason: "Payment timed out" }));

  const result = await runPromise;

  expect(result.getStatus()).toBe(ExecutionStatus.SUCCEEDED);
  expect(result.getResult()).toEqual({ orderId: "order-003", status: "compensated" });

  const compensate = runner.getOperation("compensate");
  expect(compensate.getStatus()).toBe(OperationStatus.SUCCEEDED);

  expect(updateOrder).toHaveBeenCalledTimes(2);
});