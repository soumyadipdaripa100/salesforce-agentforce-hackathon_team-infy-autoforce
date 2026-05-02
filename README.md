# salesforce-agentforce-hackathon_team-infy-autoforce

# Electra Concierge - Automotive Customer Intelligence Platform

**Salesforce Agentforce National Hackathon 2026 - Team Electra (Infosys)**
› Built with Agentforce + Data Cloud-style intent scoring + Automotive Cloud + Digital Engagement + Flow + Apex + Lightning Web Components

---

## Demo Video

Submission video: **[5-minute walkthrough] (https://[your-youtube-or-drive-ur1-here])** *(replace with final URL before submitting)*

For the live presentation deck, see docs/Electra_Concierge_Deck.pdf (or "-pptx).

---

## What This Is

An AI-powered test drive booking and customer intelligence platform for **Electra Cars**, a fictional premium EV OEM. We replaced Electra's 15-field booking form (1% conversion) with a **multi-agent Agentforce system** that:

1. Books test drives in 30 seconds via natural conversation across web, Whatsapp, and other messaging channels
2. Scores every web visitor's intent in real time and surfaces high-intent prospects to the dealer queue automatically
3. Equips the dealership sales rep with a conversational AI copilot that handles the post-booking lifecycle from arrival to outcome capture to opportunity creation

The result: **1% → 8-12% projected conversion**, **10-minute → 30-second booking time**, **60% →
98% Lead data quality*, **30% → 10% no-show rate**.

---

## The Three Agents

### Agent 1 — Electra Test Drive Concierge (customer-facing)
- **Type:** ExternalCopilot / EinsteinServiceAgent
- **5 Topics:** Book Test Drive, Vehicle Information, Dealership Finder, Experience Drive, Human Handoff
- **13 Action registrations** wrapping 4 Apex Invocables (`TD_GetVehicleModels`, `TD_AgentHelper`, `TD_CheckAvailableSlots`, `TD_CreateBooking`) + 2 Flows (`TD_Send_Confirmation`, `TD_Create_Dealer_Task`)
- Handles one-message bookings (`"Book GT near 94105 Saturday 2pm, I'm Priya, priya@email.com"`), needs-based recommendations (`"two kids"` → SUV), and **Experience Drive** delivery requests (premium home delivery — Tesla 48-hour / Volvo Test Drive+ inspired)

### Agent 2 — Electra Dealer Advisor (dealer-facing)
- **Type:** ExternalCopilot / EinsteinServiceAgent
- **4 Topics:** Dealer Dashboard (today's bookings, intel briefs, KPIs), Dealer Lifecycle (status transitions), Dealer Outcomes (post-drive capture), Dealer Handoff
- **7 Action registrations** wrapping 5 Apex classes (`TD_Agent_Dealer*` family)
- Sales rep types `"Priya just arrived"` → status updates, welcome email auto-fires, Sales_Rep stamped. Types `"Log outcome — very interested, send a quote"` → Opportunity auto-creates with model-based pricing

### Agent 3 — Test Drive WhatsApp Agent (customer-facing, WhatsApp / messaging)
**Type:** Externalcopilot / EinsteinServiceAgent
- **1 Topic:** Test Drive Using WhatsApp - guided slot-filling conversation tuned for the WhatsApp surface (asks one question at a time: name → email → vehicle → showroom → date → time)
- **4 Apex actions** (`TD_GetShowrooms`, `TD_GetvehicleModels`,`TD_CheckAvailableslots`,`TD_CreateBooking`) plus the standard `AnswerQuestionswithKnowledge` planner action
- Channel-specific surface targeting (Messaging + Customerwebclient) with rich content enabled and verified-user rule expression for context-aware responses
- Reuses the same backend Apex stack as the Concierge - same data, same booking pipeline - proving the channel-agnostic architecture

## Key Differentiators

1. **Experience Drive** - car delivered to customer's doorstep for a full day; the only Salesforce hackathon entry to capture this differentiator from the premium-EV market
2. **Six-signal Intent Scoring** - 
3. **Lead Personalization** - `TD_PersonalizeLead` enriches every Lead at creation with intent score, intent tier (VIP/High/Medium/Low), and preferred model - sales reps see qualified leads, not cold ones
4. **Abandon Recovery** - daily `TD_AbandonRecovery` Apex job creates dealer tasks for high-itent visitors who didn't book, so the dealer wakes up to a qualified outreach list
5. **Three-Agent Orchestration** - most hackathon teams build one agent. We built three - a customer-facing Concierge, a channel-specialised Whatsapp variant, and a dealer-facing Advisor - wired through a shared apex backend
Advisor - wired through a shared Apex backend
6. **Full Lifecycle** - pre-drive reminder, post-drive follow-up, no-show recovery, abandon recovery (all native Flows +Apex; Mc Next-ready architecture
7. **Automotive Cloud Native** - every vehicle is a "VehicleDefinition" record (51 EV-specific fields) - not a custom object

---

## Repository Structure

```
├── README.md                          ← this file
├── sfdx-project.json
├── force-app/main/default/
│   ├── classes/                       ← 41 Apex classes + tests
│   ├── flows/                         ← 11 Active flows
│   ├── lwc/                           ← 8+ Lightning components
│   ├── bots/                          ← Concierge + Dealer Advisor
│   ├── genAiPlannerBundles/           ← Topic + action plans for both agents
│   ├── objects/                       ← Test_Drive__c, Web_Engagement_Event__c, etc.
│   ├── permissionsets/                ← 3 perm sets
│   ├── staticresources/electraEvImages/  ← brand imagery
│   └── ...
```

---

## Team

| Member | Workstream |
|---|---|
| **Amit Agarwal** | Agentforce + Digital Engagement + Solution Architecture + Submission |
| **Soumyadip** | Backend (Flows, Apex, Custom Objects) |
| **Subhranil** | Frontend (Experience Cloud, LWCs, Static Resources) |
| **Amar** | Data Cloud + Intent Pipeline + Calculated Insight |
| **Chandan** | Data Cloud support + sample data |

---

## Credits & Acknowledgments

- **Electra Cars** is a fictional EV OEM created for hackathon purposes. No real OEM brand identity is used.
- Test customer names (Priya, Alex, Maya, Sarah, John, Sam) are fictional.
- Built on **Salesforce Agentforce, Data Cloud, Automotive Cloud, Digital Engagement, Flow, Apex, Lightning Web Components, Experience Cloud**, and Omnistudio.
- Inspired by the premium-EV test drive programs of Tesla (48-hour), Volvo (Test Drive+), BMW (Home Test Drive), and Porsche (At-Home).
