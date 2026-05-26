# QuantaSneaks

Limited-edition sneaker drop powered by AWS Lambda Durable Functions. Demonstrates the saga pattern with two human-in-the-loop gates, LLM risk scoring, compensation stack, and status polling.

---

## Architecture

```
Browser
  │
  ├─ POST /order             → orderLambda (regular)
  │                              creates order, fires durableLambda async
  │                              returns 302 → UI status page
  │
  └─ GET/POST /ui?...        → uiLambda (regular, Function URL)
                                 serves HTML, polls DynamoDB, resolves callbacks

durableLambda (durable)
  ├── step: llm-analysis         → risk score
  ├── waitForCallback: payment   → suspends up to 1 hr (zero compute)
  ├── waitForCallback: admin     → suspends up to 24 hrs (zero compute)
  ├── step: ship-order           → status = shipped
  ├── step: send-confirmation    → confirmation email sent
  └── catch
        ├── step: refund-payment     → saga compensation (if payment was taken)
        └── step: compensate         → status = compensated
```

---

## Saga Compensation Pattern

Each forward step that creates a side effect registers a compensation:

| Forward Step | Compensation |
|---|---|
| `waitForCallback('payment')` | `refund-payment` — pushed after payment resolves |
| `step('ship-order')` | *(none — terminal success step)* |

Compensations are stored in a stack and run in **reverse order** on any failure (admin rejection, timeout, or error). The final `compensate` step always runs last to update the order status.

---

## DynamoDB Table - `quantasneaks`

**Partition key:** `orderId` (String)

| Attribute            | Type   | Set when                             |
|----------------------|--------|--------------------------------------|
| `orderId`            | String | Order created (orderLambda)          |
| `status`             | String | Every state transition               |
| `size`               | String | Order created                        |
| `createdAt`          | String | Order created (ISO timestamp)        |
| `riskLevel`          | String | After LLM step                       |
| `riskReason`         | String | After LLM step                       |
| `paymentCallbackId`  | String | When payment waitForCallback starts  |
| `approvalCallbackId` | String | When admin waitForCallback starts    |

### Status flow

```
processing → awaiting_payment → awaiting_approval → shipped
                             ↘                    ↘
                           compensated           compensated
                        (payment timeout)    (admin reject/timeout)
```

---

## Workflow

1. User selects size, clicks **CLAIM YOUR PAIR**
2. `orderLambda` creates `orderId`, writes `status: processing`, fires `durableLambda`
3. `durableLambda` runs LLM analysis (dummy), then calls `waitForCallback('payment', ...)`
   - Writes `status: awaiting_payment` + `paymentCallbackId` to DB
   - **Suspends — zero compute cost**
4. Client polls `GET ?action=poll&orderId=x` every 3s
   - Sees `awaiting_payment` → redirects to payment page
5. User clicks **PAY NOW**
   - `uiLambda` resolves the payment callback with a `paymentId`
   - `durableLambda` resumes, registers `refund-payment` compensation
6. `durableLambda` calls `waitForCallback('admin-approval', ...)`
   - Writes `status: awaiting_approval` + `approvalCallbackId`
   - **Suspends again — zero compute cost**
7. Client sees `awaiting_approval` — shows pending message
8. Admin opens `?view=admin` → sees order with risk score
9. Admin clicks **Approve** or **Reject**
   - `uiLambda` resolves the approval callback (success or failure)
10. **On approve:** `ship-order` → `send-confirmation` → `status: shipped`
    **On reject/timeout:** compensations run in reverse → `refund-payment` → `compensate` → `status: compensated`

---

## Lambda Environment Variables

### orderLambda
| Variable             | Value                                                                        |
|----------------------|------------------------------------------------------------------------------|
| `ORDERS_TABLE`       | `quantasneaks`                                                               |
| `DURABLE_LAMBDA_ARN` | `arn:...:function:durableLambda:$LATEST` — must include `:$LATEST` qualifier |
| `UI_LAMBDA_URL`      | `https://xxx.lambda-url.region.on.aws` — must point to **uiLambda**         |

### durableLambda
| Variable       | Value          |
|----------------|----------------|
| `ORDERS_TABLE` | `quantasneaks` |

### uiLambda
| Variable           | Value                                  |
|--------------------|----------------------------------------|
| `ORDERS_TABLE`     | `quantasneaks`                         |
| `ORDER_LAMBDA_URL` | `https://xxx.lambda-url.region.on.aws` |

---

## IAM Permissions

### orderLambda role
- `dynamodb:PutItem` on `quantasneaks`
- `lambda:InvokeFunction` on `arn:...:function:durableLambda:*`

### durableLambda role
- `AWSLambdaBasicDurableExecutionRolePolicy` (managed)
- `dynamodb:UpdateItem` on `quantasneaks`

### uiLambda role
- `dynamodb:GetItem`, `dynamodb:Scan` on `quantasneaks`
- `lambda:SendDurableExecutionCallbackSuccess` on `arn:...:function:durableLambda:*`
- `lambda:SendDurableExecutionCallbackFailure` on `arn:...:function:durableLambda:*`

---

## Deploy Steps

1. Create DynamoDB table `quantasneaks` with partition key `orderId` (String)
2. Deploy `durableLambda` — enable DurableConfig, attach managed policy, set env vars
3. Deploy `orderLambda` — create Function URL, set env vars
4. Deploy `uiLambda` — create Function URL, set env vars, `npm install` before zipping
5. Open `uiLambda` Function URL in browser

---

## uiLambda Routes

| Method | Query                     | Description                   |
|--------|---------------------------|-------------------------------|
| GET    | (none)                    | Landing page                  |
| GET    | `?view=status&orderId=x`  | Order status page             |
| GET    | `?action=poll&orderId=x`  | JSON polling endpoint         |
| GET    | `?view=payment&orderId=x` | Payment page                  |
| GET    | `?view=admin`             | Admin approval dashboard      |
| GET    | `?asset=filename.png`     | Serve static image            |
| POST   | `?action=pay`             | Resolve payment callback      |
| POST   | `?action=approve`         | Resolve approval → success    |
| POST   | `?action=reject`          | Resolve approval → failure    |
