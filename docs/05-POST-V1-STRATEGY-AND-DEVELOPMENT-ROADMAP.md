# Kachko — Post‑V1 Product Strategy & Development Roadmap

> **Purpose:** Consolidate the current implemented V1 baseline, explain how Kachko should differentiate in a market where Instagram and other social platforms already support multiple bio links and basic insights, and define the next development steps to build on top of the existing product.
>
> **Status basis:** This roadmap assumes the current Kachko repository already contains the V1 backend/platform work documented in the latest HLD, LLD and Development Blueprint, including authentication, pages, links, editor backend, themes/socials, analytics, sharing/SEO/QR and launch protections, with remaining joint browser/staging/release gates to be completed.
>
> **Strategic direction:** Do not compete as "another Linktree." Evolve Kachko into a creator/business conversion platform:
>
> **Identity → Audience → Conversion → Commerce → Automation → Intelligence**

---

# 1. Why Kachko Must Move Beyond Links

Instagram and other social networks increasingly provide:

- multiple profile links
- profile visits
- reach
- engagement
- basic link insights

This means the basic value proposition:

```text
"Put all your links in one place"
```

will continue to become commoditized.

Kachko should therefore not primarily compete on:

```text
more links
more colors
more icons
more themes
basic visit counts
```

Those are useful product capabilities, but they are not a durable reason for someone to use Kachko instead of native Instagram features.

The long-term problem Kachko should solve is:

> **What happens after somebody visits a creator's profile?**

The product should help creators turn social traffic into:

```text
Visitors
   ↓
Clicks
   ↓
Leads
   ↓
Subscribers
   ↓
Bookings
   ↓
Customers
   ↓
Revenue
```

That gives Kachko a purpose that Instagram itself does not fully solve.

---

# 2. Kachko's Long-Term Positioning

Do not position the product only as:

> Free Linktree alternative

That can still be used for SEO and competitor landing pages.

The product identity should evolve toward:

# **Kachko — Your creator business, behind one link.**

Supporting message:

> Build your page.  
> Capture your audience.  
> Get enquiries.  
> Take bookings.  
> Sell.  
> Get paid.  
> Understand what converts.

A more conversion-focused alternative:

# **Turn your social traffic into customers.**

This directly answers:

> Why should I use Kachko when Instagram already lets me add links?

Because Instagram gives the creator traffic.

Kachko helps the creator **convert, own and monetize that traffic**.

---

# 3. Instagram Is a Traffic Source, Not the Core Competitor

The desired ecosystem is:

```text
Instagram
YouTube
LinkedIn
TikTok
X
Google
WhatsApp
GitHub
       ↓
     Kachko
       ↓
Identity
Audience
Commerce
Conversion
```

Kachko should remain independent from any single social platform.

A creator may lose reach, switch platforms or grow on another channel.

Their Kachko page remains:

```text
their public identity
their audience capture point
their customer conversion layer
their commerce surface
```

This independence is important.

---

# 4. Current V1 Baseline

The current repository is already significantly beyond an early prototype.

Based on the current implementation blueprint, the product includes or has backend implementation for:

## Identity

```text
Registration
Login/logout
Google login/onboarding
Sessions
Username checks
Profile APIs
Password recovery
```

## Page foundation

```text
Page CRUD
LINK CRUD
TEXT CRUD
Publish/unpublish
Public lookup
Cache invalidation
Multiple-page-ready database model
```

## Editor backend

```text
Visibility
Transactional reorder
TEXT block support
Public serialization
```

## Appearance and social

```text
System themes
Templates
Appearance overrides
Social profile CRUD
Social reorder
Public cache integration
```

## Media

```text
R2 authorization/completion
Media ownership
Metadata
IMAGE block support
```

## Analytics

```text
PAGE_VIEW
LINK_CLICK
SOCIAL_CLICK

Today
7 days
30 days

Summary
Timeseries
Breakdowns
Redis rate limits
Privacy-minimized tracking
Retention/pruning
```

## Growth

```text
Canonical sharing
SEO
Open Graph metadata
QR
```

## Platform protection

```text
Reports
Moderation
Roles
Audit logs
Suspension
Permanent account deletion
Security controls
```

The main V1 development priority is therefore not adding commerce immediately.

It is:

> **finish integration, staging and production release gates first.**

---

# 5. Immediate Development Priority — Finish V1 Properly

Before implementing the post‑V1 roadmap, complete the current release.

## Step 1 — Close frontend integration gates

Verify real API integration for:

```text
Registration
Login
Google login
Username onboarding
Profile
Page creation
Link creation
Text blocks
Themes
Social profiles
Media
Analytics
QR/share
Account deletion
Reports
Moderation
```

Do not mark a feature complete purely because backend code exists.

---

# 6. Step 2 — Verify the Core Browser Journey

Required production-like journey:

```text
Register
   ↓
Choose username
   ↓
Create primary page
   ↓
Add LINK
   ↓
Add TEXT
   ↓
Upload image
   ↓
Change theme
   ↓
Add socials
   ↓
Publish
   ↓
Open public URL
   ↓
Click link
   ↓
Verify analytics
   ↓
Share QR
```

This should be automated as a Playwright E2E test.

---

# 7. Step 3 — Complete V1 UX Gates

Verify:

```text
Loading
Empty
Success
Error
Retry
Expired session
Mobile
Tablet
Desktop
Keyboard navigation
```

Particularly important:

- autosave failure recovery
- drag/drop + manual reorder
- media upload progress/retry
- missing public profile
- suspended profile
- deleted profile
- unpublished profile
- analytics empty state

---

# 8. Step 4 — Complete Staging

Staging should use:

```text
Vercel
Azure Container Apps
PostgreSQL
Redis
R2
```

with isolated credentials/data.

Validate:

```text
cookies
CORS
CSRF
OAuth callback
R2 uploads
cache invalidation
analytics beacon
QR
SEO metadata
account deletion
moderation
```

---

# 9. Step 5 — Production Readiness

Before launch:

```text
DB backups
Restore test
Monitoring
Error reporting
Cost alerts
API readiness
Rollback
Load checks
Security headers
Rate limits
```

Only then treat V1 as released.

---

# 10. Post‑V1 Product Strategy

Once V1 is stable, build the next capabilities in this order:

```text
V1.1  Conversion Basics
V1.2  Smart Growth
V1.3  Audience Ownership
V2.0  Payments
V2.1  Services & Booking
V2.2  Digital Products
V2.5  Affiliate Commerce
V3.0  Automation
V4.0  Professional Creator OS
V5.0  Creator/Brand Ecosystem
V6.0  Intelligence
```

This sequence deliberately moves the product away from a link directory and toward business outcomes.

---

# 11. V1.1 — Conversion Basics

## Why this should be the next release

This is the fastest way to differentiate from native Instagram links.

A creator should immediately be able to say:

> My Instagram profile gives me traffic.  
> Kachko gives me leads.

## Features

### WhatsApp CTA

New block:

```text
WHATSAPP
```

Creator configuration:

```text
Phone number
CTA label
Prefilled message
Optional service
Optional campaign
```

Example:

```text
Need a website?

[ Chat on WhatsApp ]
```

Prefilled:

```text
Hi Rohan,
I found your Kachko page and
I'm interested in website development.
```

---

# 12. Simple Contact Form

New block:

```text
FORM
```

Initial field types:

```text
Name
Email
Phone
Message
Select
Checkbox
```

Do not build a full form builder initially.

Start with:

```text
Contact me
Work with me
Request quote
Join waitlist
```

templates.

---

# 13. Email Capture

New block:

```text
SUBSCRIBE
```

Example:

```text
Join my newsletter

Email
[ Subscribe ]
```

Initial behavior:

```text
capture subscriber
store contact
allow CSV export
```

Do not build full email broadcasting in V1.1.

---

# 14. V1.1 Data Model

Introduce:

```text
Contact
Form
FormField
FormSubmission
ContactTag
```

Important rule:

```text
Kachko authenticated User
≠
Creator Contact
```

Contacts are people interacting with the creator.

---

# 15. V1.1 APIs

Suggested:

```text
POST   /api/v1/pages/:pageId/forms
GET    /api/v1/pages/:pageId/forms
PATCH  /api/v1/forms/:formId
DELETE /api/v1/forms/:formId

POST /api/v1/public/forms/:formId/submissions

GET   /api/v1/audience/contacts
GET   /api/v1/audience/contacts/:contactId
GET   /api/v1/audience/export
```

---

# 16. V1.1 Analytics

Add:

```text
FORM_VIEW
FORM_SUBMIT
LEAD_CREATED
WHATSAPP_CLICK
SUBSCRIBE
```

Now Kachko can show:

```text
2,840 visitors
   ↓
620 clicks
   ↓
93 leads
```

This becomes the beginning of a conversion funnel.

---

# 17. V1.1 Dashboard

Add:

```text
Audience
```

Dashboard:

```text
Contacts
─────────────────────────
Rahul      Website enquiry
Priya      Newsletter
Akash      Consultation
```

For this release, keep CRM minimal.

---

# 18. V1.1 Definition of Done

```text
Creator adds WhatsApp CTA
Visitor opens WhatsApp
Click recorded

Creator adds form
Visitor submits
Contact appears in dashboard

Creator adds subscribe block
Subscriber captured
Creator can export CSV
```

This release gives Kachko its first major answer to native Instagram links.

---

# 19. V1.2 — Smart Growth

## Objective

Make Kachko links more intelligent than normal bio links.

Features:

```text
Scheduled blocks
Expiring blocks
Smart links
UTM attribution
Collections
Dynamic content blocks
```

---

# 20. Scheduled / Expiring Blocks

Extend PageBlock:

```text
visibleFrom
visibleUntil
```

Use cases:

- event registration
- launches
- discount periods
- affiliate campaigns
- giveaways

Example:

```text
Early Bird
Visible: Sep 25 → Sep 30
```

---

# 21. Smart Links

New capability:

```text
SMART_LINK
```

Rule engine can select destination using:

```text
Country
Device
Referrer
Date/time
UTM source
```

Examples:

```text
Android → Play Store
iOS → App Store
```

```text
India → UPI/Razorpay
Other → global checkout
```

---

# 22. Collections

Introduce a reusable concept:

```text
Collection
```

Examples:

```text
My Coding Setup
Travel Essentials
Latest Videos
My Courses
Recommended Tools
Wedding Looks
```

Route:

```text
kachko.com/rohan/c/coding-setup
```

Collections can eventually hold:

```text
Links
Products
Videos
Resources
Affiliate products
```

This is important because Kachko should evolve beyond a single vertical list.

---

# 23. Dynamic Blocks

Useful additions:

```text
Latest YouTube
RSS Feed
Latest Blog
GitHub Repositories
Latest Podcast
```

Architecture:

```text
third-party sync
→ background job
→ cache
→ public renderer
```

Do not call external APIs directly during every public page render.

---

# 24. Attribution

Track:

```text
utm_source
utm_medium
utm_campaign
utm_content
referrer
```

Analytics should answer:

```text
Where did traffic come from?
What did it click?
Did it become a lead?
```

---

# 25. V1.2 Definition of Done

Creator can:

```text
schedule CTA
create collection
create device-specific link
see traffic by source
understand lead source
```

---

# 26. V1.3 — Audience Ownership

## Objective

Move from isolated form submissions to a lightweight creator CRM.

This is a major strategic differentiator.

Instagram owns followers.

Kachko should help the creator own:

```text
Leads
Subscribers
Customers
```

---

# 27. Contact Model

Extend Contact with:

```text
name
email
phone
status
source
lastActivityAt
createdAt
```

Stages:

```text
NEW
CONTACTED
QUALIFIED
WON
LOST
```

---

# 28. Contact Timeline

Example:

```text
Rahul

Sep 20
Submitted "Website Enquiry"

Sep 20
Clicked WhatsApp

Sep 21
Creator marked Contacted

Sep 22
Booked consultation
```

This will later become highly valuable for automation.

---

# 29. Tags

Examples:

```text
Website lead
Newsletter
VIP
Course buyer
Consultation
Brand
```

---

# 30. Lead Magnets

Creator offers:

```text
Free Node.js Checklist
```

Visitor:

```text
enters email
→ becomes contact
→ receives download
```

This is a strong creator growth feature.

---

# 31. Audience Ownership Positioning

Kachko should explicitly allow:

```text
Export contacts
Export customers
Export orders
```

Potential brand message:

> **Your audience belongs to you.**

This creates trust and differentiates Kachko from closed social platforms.

---

# 32. V2.0 — Payments

## Objective

Turn Kachko into a transactional platform.

The creator should be able to:

```text
Get paid
Receive tips
Collect service deposits
Create payment links
```

India-first:

```text
Razorpay
UPI
INR
```

Global later:

```text
Stripe
PayPal
```

---

# 33. Payment Architecture

Do not couple business logic directly to Razorpay.

Use:

```text
PaymentIntent
       ↓
PaymentProvider
       ├── Razorpay
       ├── Stripe
       └── PayPal
```

---

# 34. Payment Blocks

Examples:

```text
PAY
TIP
DONATION
```

Example:

```text
Support my work

₹100
₹250
₹500
Custom

[ Pay ]
```

---

# 35. Payment Links

Example:

```text
kachko.com/rohan/pay/consultation
```

Can have:

```text
fixed amount
custom amount
description
expiry
```

---

# 36. Payment Events

Add:

```text
PAYMENT_STARTED
PAYMENT_COMPLETED
PAYMENT_FAILED
PAYMENT_REFUNDED
```

Now analytics can show:

```text
Instagram
3,420 visitors
   ↓
184 leads
   ↓
31 payments
   ↓
₹28,430 revenue
```

This is where Kachko becomes fundamentally different from native bio links.

---

# 37. V2.1 — Services & Booking

## Target Users

```text
Freelancers
Consultants
Coaches
Tutors
Photographers
Developers
Designers
Fitness trainers
```

New block:

```text
BOOKING
```

Example:

```text
30-minute consultation
₹799

Tue 7:00 PM
Wed 6:30 PM

[ Book ]
```

---

# 38. Booking Model

Introduce:

```text
BookingType
AvailabilityRule
Booking
```

Integrations later:

```text
Google Calendar
Google Meet
Zoom
```

---

# 39. Booking Flow

```text
Choose service
→ Choose slot
→ Enter details
→ Pay
→ Booking created
→ Confirmation
```

Creator analytics:

```text
Page visits
→ Booking views
→ Booking started
→ Booking completed
```

---

# 40. V2.2 — Digital Products

Creator sells:

```text
PDF
Template
Code
Preset
Guide
eBook
Video
Digital resource
```

Flow:

```text
Product
→ Checkout
→ Payment
→ Order
→ Entitlement
→ Signed download
```

Do not make public R2 links permanent for paid files.

---

# 41. Mini Storefront

Public routes:

```text
kachko.com/rohan/shop
kachko.com/rohan/product/node-guide
```

Creator page can still include products as normal blocks.

---

# 42. Commerce Dashboard

Add:

```text
Products
Orders
Customers
Revenue
Coupons
```

Do not build full physical-commerce logistics initially.

Kachko should remain a creator-business tool, not become Shopify.

---

# 43. V2.5 — Affiliate Commerce

This is inspired by creator-commerce products such as Wishlink.

Objective:

> Help creators earn from products they recommend.

Features:

```text
Affiliate links
Product recommendation blocks
Affiliate collections
Click attribution
Conversion tracking
Commission dashboard
```

---

# 44. Product Recommendation Block

Example:

```text
Mechanical Keyboard

₹6,999
Amazon

[ View Product ]
```

Store:

```text
merchant
destinationUrl
affiliateTrackingUrl
productMetadata
```

---

# 45. Affiliate Collections

Examples:

```text
My Coding Setup
Gym Essentials
Travel Gear
Skin Care
Wedding Outfit
Books I Recommend
```

This has strong potential for fashion/lifestyle creators.

---

# 46. Affiliate Analytics

Creator dashboard:

```text
Clicks
Conversions
GMV
Commission
Conversion rate
Earnings per click
```

---

# 47. Content → Product Mapping

Creator maps content to products.

Example:

```text
Instagram Reel:
"My Desk Setup"

Products:
Monitor
Keyboard
Mouse
Desk
Lamp
```

Then one Kachko page shows all products from that content.

---

# 48. V3.0 — Automation

Once Kachko owns events, contacts and commerce, automation becomes valuable.

Core:

```text
WHEN
event happens

IF
condition

THEN
action
```

---

# 49. Automation Examples

```text
WHEN lead created
THEN tag "website lead"
```

```text
WHEN booking created
THEN send confirmation
```

```text
WHEN product purchased
THEN deliver file
```

```text
WHEN subscriber added
THEN send welcome email
```

---

# 50. Instagram Comment → DM

Potential creator workflow:

```text
Creator says:
Comment "LINK"
```

Then:

```text
Comment detected
→ DM product/collection URL
```

Implement only through supported platform APIs.

Do not rely on browser automation/scraping.

---

# 51. WhatsApp Automation

Examples:

```text
Lead submitted
→ acknowledgement
```

```text
Booking tomorrow
→ reminder
```

```text
Payment successful
→ confirmation
```

Use official WhatsApp Business APIs.

---

# 52. External Integrations

Prioritize:

```text
Razorpay
Google Calendar
Google Analytics
Meta Pixel
Mailchimp/Brevo
Zapier
Make
Pabbly
n8n
```

Build an integration registry rather than hardcoding providers.

---

# 53. Webhooks & Developer API

Future events:

```text
page.viewed
link.clicked
lead.created
booking.created
payment.completed
order.paid
subscriber.created
```

Example webhook:

```text
POST https://creator-app.com/webhooks/kachko
```

Developer friendliness can become a meaningful Kachko differentiator.

---

# 54. V4.0 — Professional Creator OS

Target:

```text
Professional creators
Freelancers
Agencies
Brands
```

Features:

```text
Media kit
Brand enquiries
Deal pipeline
Invoicing
Teams
Agency management
```

---

# 55. Media Kit

Route:

```text
kachko.com/rohan/media-kit
```

Include:

```text
Bio
Niche
Audience
Platform links
Portfolio
Collaborations
Reach
CTR
Conversion
Attributed revenue
Rates
Contact
```

This is stronger than simply showing follower counts.

---

# 56. Deal Pipeline

```text
New
Negotiating
Accepted
Content Due
Completed
Paid
```

Kachko becomes part of the creator's business operations.

---

# 57. Agency Accounts

Workspace:

```text
Agency
├── Client A
├── Client B
├── Client C
```

Roles:

```text
OWNER
ADMIN
EDITOR
ANALYST
```

This creates higher-value B2B monetization.

---

# 58. V5.0 — Creator / Brand Ecosystem

Only implement after significant creator traction.

Features:

```text
Creator discovery
Brand accounts
Campaigns
Creator invitations
Deliverables
Payouts
Product sourcing
Affiliate network
```

This introduces network effects.

Do not build this while the creator side is still small.

---

# 59. V6.0 — Intelligence

AI should improve creator outcomes, not exist only because competitors have an AI button.

---

# 60. AI Page Builder

During onboarding:

```text
Who are you?

Creator
Freelancer
Developer
Coach
Business
Student
```

Then:

```text
What is your goal?

Grow audience
Get clients
Sell products
Get bookings
Affiliate income
Organize links
```

Kachko generates:

```text
Profile
Recommended blocks
CTA
Layout
Theme
```

---

# 61. AI Growth Advisor

Instead of only reporting:

```text
Views: 4,230
Clicks: 520
```

Kachko should say:

> Your consultation link has the best conversion rate but appears at position 7.

> LinkedIn traffic converts 2.3× better than Instagram for consultation leads.

> Your first CTA receives many impressions but a low CTR.

Then:

```text
[ Apply recommendation ]
```

---

# 62. Automatic Experiments

Examples:

```text
Book a Call
vs
Talk to Me
```

or:

```text
Portfolio first
vs
Consultation first
```

Measure:

```text
CTR
Lead conversion
Purchase conversion
```

---

# 63. Dynamic Personalization

Much later:

```text
Instagram visitor
→ content/products first

LinkedIn visitor
→ portfolio/services first

Returning customer
→ new products first
```

This turns Kachko into an adaptive creator page.

---

# 64. Standout UX — Intent-First Builder

This should become one of the strongest Kachko differentiators.

Do not force users to understand technical block names.

Ask:

# What do you want your visitor to do?

```text
🔗 Visit something
💬 Contact me
📩 Join my audience
📅 Book me
🛍 Buy something
💸 Pay me
🎁 Support me
📥 Download
▶ Watch/listen
❤️ Follow me
```

Then Kachko selects/configures the appropriate block.

Example:

```text
Contact me
   ↓
WhatsApp
Form
Email
Call
```

This makes an increasingly powerful product remain simple.

---

# 65. Persona-Based Onboarding

Ask:

# What best describes you?

```text
Creator
Freelancer
Business
Developer
Coach
Student
Photographer
```

Then:

# What is your main goal?

```text
Grow social accounts
Get clients
Build audience
Sell products
Get bookings
Affiliate income
Organize links
```

---

# 66. Persona Templates

## Freelancer + Get Clients

Generate:

```text
Profile
Portfolio
Services
Testimonials
Book Call
WhatsApp
Contact Form
```

## Fashion Creator + Affiliate Income

Generate:

```text
Profile
Latest Looks
Shop My Look
Collections
Instagram
YouTube
```

## Developer + Get Clients

Generate:

```text
Profile
GitHub
Projects
Resume
Services
Book Consultation
Contact
```

This creates a better onboarding experience than a blank page builder.

---

# 67. Analytics Evolution

## V1

```text
Views
Clicks
CTR
Devices
Referrers
```

## V1.1

```text
Leads
Form submissions
WhatsApp clicks
Subscribers
```

## V2

```text
Bookings
Payments
Revenue
```

## V2.5

```text
Affiliate conversions
GMV
Commission
```

## Mature

```text
Visitor
→ Click
→ Lead
→ Booking
→ Customer
→ Revenue
```

This is the analytics differentiation.

---

# 68. Core Product Funnel

Kachko should eventually provide:

```text
Instagram
   ↓
3,420 visitors
   ↓
1,042 meaningful actions
   ↓
184 leads
   ↓
31 purchases/bookings
   ↓
₹28,430 revenue
```

That is much more valuable than:

```text
profile visits
link clicks
```

---

# 69. Monetization Strategy

Kachko should have multiple revenue sources.

## Subscription

Suggested evolution:

```text
FREE
PRO
GROWTH
BUSINESS
AGENCY
```

---

# 70. Free Tier

Keep free genuinely valuable:

```text
Profile
Links
Core blocks
Themes
Basic analytics
QR
Social profiles
Media
Kachko branding
```

Free users create distribution.

---

# 71. Pro

Potential:

```text
₹199–₹299/month
```

Features:

```text
Remove branding
Premium themes
Advanced appearance
Scheduling
More pages
Advanced analytics
SEO controls
```

---

# 72. Growth

Potential:

```text
₹499–₹699/month
```

Features:

```text
Forms
CRM
Lead magnets
Advanced attribution
Integrations
Automation quota
```

---

# 73. Business

Potential:

```text
₹999–₹1,499/month
```

Features:

```text
Payments
Products
Bookings
Lower transaction fees
Advanced commerce analytics
```

Pricing should be validated before finalization.

---

# 74. Transaction Fees

Possible model:

```text
Free seller
higher platform fee

Paid seller
lower platform fee

Business
minimal / zero Kachko fee
```

Do not hide payment gateway fees.

---

# 75. Affiliate Revenue

Potential model:

```text
Merchant commission
      ↓
Creator share
+
Kachko share
```

Creator economics must remain attractive and transparent.

---

# 76. Agency Revenue

Later agency tier:

```text
₹2,999+/month
```

Based on:

```text
managed accounts
team members
automation volume
analytics
```

---

# 77. AI Usage Revenue

Advanced AI can use monthly quotas/credits:

```text
Page generation
Growth analysis
Copy suggestions
Campaign suggestions
Audience segmentation
```

Do not promise unlimited high-cost AI in lifetime plans.

---

# 78. Early Lifetime Plan Option

A limited founding plan can help generate initial revenue.

Example:

```text
Kachko Founding Pro
₹2,999 one-time
```

Can include:

```text
branding removal
premium themes
appearance controls
identity features
```

Do NOT include unlimited:

```text
AI
storage
email
automation
payments
```

because those have ongoing cost.

---

# 79. Growth Loops

## Made with Kachko

Free public profiles can have tasteful attribution.

```text
Visitor
→ sees Kachko
→ creates own page
```

---

# 80. Template Sharing

```text
Use my template
```

Creator pages become acquisition channels.

---

# 81. Referral Program

Example:

```text
Invite creator
→ earn Pro credit
```

Later:

```text
Paid referral
→ commission
```

---

# 82. Import / Switching

Allow creators to import supported data from existing bio tools.

Flow:

```text
Paste current profile
→ supported content detected
→ preview
→ confirm
→ create Kachko page
```

This lowers switching cost.

Must remain legally and technically compliant.

---

# 83. SEO Acquisition

Create dedicated pages for:

```text
Linktree alternative India
Link in bio for developers
Link in bio for photographers
Creator storefront India
WhatsApp bio page
UPI creator page
Bio page for freelancers
```

Use competitor SEO terms for acquisition, not product identity.

---

# 84. What NOT to Build Too Early

Avoid:

```text
Kubernetes
Microservices
Full Shopify replacement
Physical logistics
Huge social network
Banking
Lending
Native mobile apps
Brand marketplace before creator traction
Advanced AI agents before useful data
```

Your current modular monolith remains appropriate.

---

# 85. Architecture Changes to Make Before Post‑V1 Work

Do these before V1.1 grows too far.

## 85.1 Add block capability metadata

Block registry should know:

```text
category
intent
renderer
editor
analytics events
visibility support
commerce support
```

Example categories:

```text
CONTENT
CONVERSION
COMMERCE
DYNAMIC
```

---

# 86. Block Categories

## Content

```text
LINK
TEXT
IMAGE
VIDEO
SOCIAL
```

## Conversion

```text
WHATSAPP
FORM
SUBSCRIBE
BOOKING
```

## Commerce

```text
PAYMENT
PRODUCT
DONATION
AFFILIATE_PRODUCT
```

## Dynamic

```text
SMART_LINK
RSS
LATEST_YOUTUBE
COLLECTION
```

This keeps the editor extensible.

---

# 87. Add Generic Visibility Rules

Instead of adding scheduling logic separately to each future block:

```text
PageBlock
  ↓
visibilityRules
```

Potential structure:

```json
{
  "visibleFrom": null,
  "visibleUntil": null,
  "countries": [],
  "devices": [],
  "sources": []
}
```

Start with time scheduling in V1.2.

---

# 88. Expand Analytics Event Framework

Keep current events, but make the service support typed future events:

```text
FORM_VIEW
FORM_SUBMIT
LEAD_CREATED
SUBSCRIBE
WHATSAPP_CLICK
PAYMENT_STARTED
PAYMENT_COMPLETED
PRODUCT_VIEW
PURCHASE
BOOKING_CREATED
AFFILIATE_CLICK
AFFILIATE_CONVERSION
```

Do not migrate analytics storage yet.

PostgreSQL remains fine until data proves otherwise.

---

# 89. Add Internal Domain Events

Useful future events:

```text
contact.created
lead.created
payment.completed
order.paid
booking.created
subscriber.created
```

Initially they can remain in-process.

Later automation can consume the same event model.

---

# 90. Add Integration Registry

Create:

```text
IntegrationDefinition
```

Fields:

```text
provider
category
authType
capabilities
configSchema
enabled
```

Capabilities:

```text
EMBED
SYNC
PAYMENT
ANALYTICS
SUBSCRIBE
AUTOMATION
WEBHOOK
```

This will prevent integration spaghetti later.

---

# 91. Keep Payments Provider-Agnostic

Before Razorpay integration, define:

```ts
interface PaymentProvider {
  createPayment(...)
  verifyWebhook(...)
  refundPayment(...)
}
```

Do not let Razorpay-specific fields leak into Product/Order business logic.

---

# 92. Keep Contacts Separate From Users

Do not turn every form submitter/customer into a Kachko account.

Architecture:

```text
User
= Kachko creator/account

Contact
= visitor/lead/subscriber/customer
```

This matters greatly for CRM and commerce.

---

# 93. Next Development Plan — Concrete Execution Order

After current V1 launch gates:

## Milestone A — Conversion Foundation

Backend:
```text
Contact schema
Form schema
Submission API
WhatsApp analytics
Audience APIs
```

Frontend:
```text
Intent-first Add Block UI
WhatsApp editor
Form editor
Subscribe block
Audience screen
```

Release:

```text
V1.1
```

---

# 94. Milestone B — Smart Growth

Backend:
```text
visibility rules
scheduled blocks
smart link rules
collections
UTM attribution
```

Frontend:
```text
schedule UI
rule builder
collections UI
source analytics
```

Release:

```text
V1.2
```

---

# 95. Milestone C — Audience CRM

Backend:
```text
contact tags
status
notes
timeline
lead magnets
export
```

Frontend:
```text
CRM table
contact detail
status management
tagging
lead magnet UI
```

Release:

```text
V1.3
```

---

# 96. Milestone D — Payments

Backend:
```text
PaymentIntent
Payment
PaymentProvider abstraction
Razorpay
webhook verification
idempotency
refunds
```

Frontend:
```text
Payment block
payment link editor
checkout
transaction dashboard
```

Release:

```text
V2.0
```

---

# 97. Milestone E — Booking

Backend:
```text
BookingType
Availability
Booking
payment linkage
calendar integration
```

Frontend:
```text
service editor
availability editor
public booking flow
booking dashboard
```

Release:

```text
V2.1
```

---

# 98. Milestone F — Products

Backend:
```text
Product
Price
Order
OrderItem
Entitlement
DigitalAsset
Coupon
```

Frontend:
```text
product editor
storefront
checkout
orders
customers
```

Release:

```text
V2.2
```

---

# 99. Milestone G — Affiliate Commerce

Backend:
```text
Merchant
AffiliateLink
AffiliateClick
Conversion
Commission
```

Frontend:
```text
affiliate product block
collections
earnings dashboard
```

Release:

```text
V2.5
```

---

# 100. Milestone H — Automation

Backend:
```text
event bus
queue
worker
Automation
Execution
Connector
Webhook
API key
```

Frontend:
```text
automation builder
integration settings
run history
webhook/API settings
```

Release:

```text
V3.0
```

---

# 101. Recommended Immediate Sprint After V1 Release

Do NOT begin with payments.

Begin with:

```text
1. Intent-first block picker
2. WhatsApp CTA
3. Contact form
4. Email capture
5. Contact/Audience model
6. Audience dashboard
7. Funnel analytics
```

This creates the clearest differentiation at relatively low technical complexity.

---

# 102. Suggested Sprint Breakdown

## Sprint 1 — Audience foundation

Rohan / Backend:

```text
Contact
Form
FormSubmission
migrations
contracts
public submission
owner contacts API
rate limits
anti-spam
```

Girish / Frontend:

```text
intent-first Add Block
Contact Form UI
public form renderer
Audience navigation
fixtures/contracts
```

---

# 103. Sprint 2 — WhatsApp + Audience

Backend:

```text
WHATSAPP event validation
contact source attribution
CSV export
contact detail
```

Frontend:

```text
WhatsApp block
prefilled message UI
contacts table
contact detail
export
```

---

# 104. Sprint 3 — Conversion Analytics

Backend:

```text
FORM_VIEW
FORM_SUBMIT
LEAD_CREATED
WHATSAPP_CLICK
conversion aggregates
source attribution
```

Frontend:

```text
funnel card
lead conversion
top source
WhatsApp CTR
form analytics
```

---

# 105. First Post‑V1 Product Demo

The next demo should not be:

```text
Look, we added more themes.
```

It should be:

```text
Instagram visitor
      ↓
Kachko
      ↓
Clicks "Need a Website?"
      ↓
Submits enquiry
      ↓
Lead appears in creator dashboard
      ↓
Creator opens WhatsApp
```

This clearly demonstrates why Kachko exists even if Instagram supports several bio links.

---

# 106. First Post‑V1 Success Metrics

Measure:

```text
% of active pages using conversion block
forms created
WhatsApp CTAs created
visitor → lead conversion
contacts captured per creator
creators viewing Audience dashboard
D30 retention
```

The most important question:

> Does adding conversion functionality make creators return to Kachko more often?

---

# 107. Product North Star Evolution

## Current V1

```text
Active published pages with visitors
```

## V1.1–V1.3

```text
Monthly creator conversions
```

A conversion can be:

```text
lead
subscriber
WhatsApp enquiry
```

## V2+

```text
Creator revenue generated through Kachko
```

## Long-term

> **Monthly value generated for creators through Kachko**

---

# 108. Final Recommendation

Your V1 has already established the correct technical base.

The next mistake would be to continue adding only:

```text
more blocks
more appearance settings
more charts
```

Instead build the next layer:

```text
V1
Identity
   ↓
V1.1
Conversion
   ↓
V1.2
Smart Growth
   ↓
V1.3
Audience Ownership
   ↓
V2
Commerce
```

The product should stop thinking primarily in terms of:

```text
"links"
```

and increasingly think in terms of:

```text
visitor intent
creator goals
conversion
audience ownership
revenue
```

That is how Kachko can remain useful even if Instagram, YouTube, LinkedIn and other platforms continue adding native profile-link features.

---

# 109. Immediate Action List

Finish these before starting the next capability release:

```text
[ ] Verify Step 4 publishable page journey
[ ] Verify Step 5 editor journey
[ ] Verify Step 6 appearance/social journey
[ ] Verify Step 7 media/IMAGE journey
[ ] Verify Step 8 deployed analytics journey
[ ] Verify Step 9 SEO/share/QR
[ ] Verify Step 10 launch protections
[ ] Complete Step 11 staging/release
[ ] Add full Playwright core journey
[ ] Run restore/rollback test
[ ] Establish production telemetry baseline
```

Then start:

```text
V1.1 — Conversion Basics
```

in this order:

```text
1. Contact domain model
2. Intent-first Add Block UI
3. WhatsApp CTA
4. Contact form
5. Email capture
6. Audience dashboard
7. Conversion analytics
8. CSV export
9. Anti-spam controls
10. Production rollout behind feature flags
```

This is the recommended next development path on top of the V1 you have already built.
