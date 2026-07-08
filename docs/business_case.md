# Business Case — Conversational Data Analyst (Self-Service Analytics)

*Project 3 deliverable · "Value case for democratized data access"*

---

## 1. The Problem

In most companies, the people who **have** the business questions are not the people who **can write SQL**. Sales, operations, finance, and marketing staff need numbers daily — "What was revenue last month?", "Which products are slipping?", "Who are our top customers?" — but every one of those questions becomes a **ticket in the analytics queue**.

The cost of that bottleneck is concrete:

- **Analyst time is consumed by repetitive ad-hoc pulls.** Industry surveys (e.g. Anaconda's *State of Data Science*) consistently find data professionals spend a large share of their week on low-value data wrangling and one-off requests rather than deep analysis.
- **Decisions wait.** A question that takes 30 seconds to answer in SQL can sit in a queue for hours or days. In a fast-moving retail business, a delayed answer is a missed decision.
- **The queue caps the business.** You cannot hire analysts fast enough to keep up with curiosity. Most "small" questions simply never get asked.

The root cause is a **skills gap**, not a data gap. The data already exists in the warehouse; the interface to it (SQL) excludes the very people who need it.

## 2. The Solution

**Conda AI** is a conversational layer over the company database. A business user asks a question in plain language; the system:

1. Generates a **schema-aware, read-only** SQL query (write/DDL statements are blocked by guardrails).
2. Executes it against the warehouse and returns the answer as a **table + an auto-selected chart**.
3. Writes a **plain-language explanation** of the result.
4. Asks a **clarifying question** when the request is ambiguous, and remembers the context for a multi-turn follow-up.
5. Logs every query and exposes a **"show the SQL"** transparency view for auditability and trust.

The effect: the analytics queue shrinks to the questions that *actually* need a human, and everyone else self-serves in seconds — safely, because the system can only read.

## 3. Target Market

- **Primary:** Small-to-mid-size enterprises (50–1,000 employees) in retail, distribution, and services with a transactional database but a thin (1–3 person) or non-existent analytics team. In Indonesia and wider Southeast Asia this is the large, underserved middle of the market.
- **Buyer:** Head of Operations / Finance, or a COO who is tired of being the bottleneck.
- **Beachhead:** Xquisite AI's existing base of **90+ enterprise clients / 400+ delivered projects** — a warm channel to land the first paying deployments without cold acquisition.

## 4. Value & ROI

The pitch is simple: **replace the cost of the analytics queue with a flat software fee.**

| | Manual analytics queue | With Conda AI |
|---|---|---|
| Time to answer a routine question | Hours–days (ticket) | Seconds (self-serve) |
| Analyst time on repetitive pulls | High | Redirected to high-value work |
| Questions actually asked | Limited by queue | Effectively unlimited |
| Cost model | Headcount (scales linearly) | Flat subscription |

**Illustrative ROI:** if self-service deflects even **~10 routine requests per day** that each consumed ~20 analyst-minutes, that is **~3+ analyst-hours/day** reclaimed — roughly **half an analyst FTE** returned to strategic work. For most SMEs a single mid-level analyst salary dwarfs a SaaS subscription, so the tool pays for itself well before full adoption. *(Figures are directional and should be validated per-customer during a pilot.)*

## 5. Pricing Model

**Tiered SaaS**, priced on seats and scope rather than query volume (so usage is never discouraged):

- **Starter** — single database, up to ~10 business users, standard guardrails. Entry price for SMEs.
- **Team** — multiple seats with role-based access (admin vs. analyst), query logs, and the benchmarking/evaluation dashboard.
- **Enterprise** — multiple data sources, SSO, custom schema/business-glossary tuning, on-prem or VPC deployment, and a support SLA.

A **2–4 week paid pilot** on the customer's own data (with an execution-accuracy benchmark report, like the one this project ships) de-risks the purchase and produces the ROI evidence for a full rollout.

## 6. Why This Is Defensible

The moat is **not** the base LLM — anyone can call one. It is everything around it that makes the answers *trustworthy*:

- **Safety guardrails** (read-only enforcement, SQL validation) that make it safe to point at a production database.
- **Schema- and business-glossary grounding** tuned to each customer's data, so "revenue" means what *their* finance team means.
- **An evaluation harness** (execution-accuracy benchmark with a gold question set) that lets a buyer *measure* correctness before trusting it — a rare and credible differentiator versus generic "chat-with-your-data" demos.
- **Domain delivery expertise** from Xquisite AI to onboard each customer's schema correctly.

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Wrong/misleading answers erode trust | Read-only guardrails, "show the SQL" transparency, clarifying questions, and a published execution-accuracy benchmark per deployment. |
| LLM API cost / rate limits at scale | Cache frequent queries; route simple intents to a smaller/cheaper model; offer self-hosted model options for Enterprise. |
| Data privacy / security concerns | VPC / on-prem deployment tier; no write access; full query audit log. |
| Ambiguous business definitions | Per-customer schema + business-glossary tuning at onboarding (the grounding layer). |

## 8. Go-To-Market

1. **Land** with paid pilots inside Xquisite AI's existing client base (warm, low-CAC channel).
2. **Prove** value with a pilot report: accuracy benchmark + hours-saved estimate on the client's real data.
3. **Expand** from one department/database to the whole org (more seats, more sources → higher tier).
4. **Repeat** by productizing the onboarding playbook so each new customer is faster to deploy than the last.

---

*Summary:* the analytics queue is a structural cost in every data-rich SME. Conda AI converts that recurring headcount cost into a flat, safe, self-service software layer — and its guardrails plus measurable accuracy are what make it trustworthy enough to actually deploy.
