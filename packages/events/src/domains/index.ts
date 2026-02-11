/**
 * Domain Event Constants for QuickWMS
 * Organized by business domain following DDD principles
 */

// ============================================================================
// INBOUND DOMAIN (QuickIntakez, QuickPalletz)
// ============================================================================

export const InboundEvents = {
  // Manifest lifecycle
  MANIFEST_CREATED: 'manifest.created',
  MANIFEST_UPDATED: 'manifest.updated',
  MANIFEST_RECEIVED: 'manifest.received',
  MANIFEST_PROCESSING_STARTED: 'manifest.processing_started',
  MANIFEST_COMPLETED: 'manifest.completed',
  MANIFEST_CANCELLED: 'manifest.cancelled',

  // Pallet lifecycle
  PALLET_CREATED: 'pallet.created',
  PALLET_ASSIGNED_TO_MANIFEST: 'pallet.assigned_to_manifest',
  PALLET_PROCESSING_STARTED: 'pallet.processing_started',
  PALLET_COMPLETED: 'pallet.completed',
  PALLET_LOCATION_CHANGED: 'pallet.location_changed',

  // Item receiving
  ITEM_RECEIVED: 'item.received',
  ITEM_INTAKE_COMPLETED: 'item.intake_completed',
  ITEM_ASSIGNED_TO_PALLET: 'item.assigned_to_pallet',
} as const;

// ============================================================================
// PROCESSING DOMAIN (QuickGradez, QuickRefurbz)
// ============================================================================

export const ProcessingEvents = {
  // Grading workflow
  GRADING_TASK_CREATED: 'grading.task_created',
  GRADING_TASK_ASSIGNED: 'grading.task_assigned',
  GRADING_TASK_STARTED: 'grading.task_started',
  GRADING_TASK_COMPLETED: 'grading.task_completed',
  GRADING_TASK_SKIPPED: 'grading.task_skipped',

  // Item condition
  ITEM_GRADED: 'item.graded',
  ITEM_CONDITION_UPDATED: 'item.condition_updated',

  // Refurbishment workflow
  REFURB_JOB_CREATED: 'refurb.job_created',
  REFURB_JOB_ASSIGNED: 'refurb.job_assigned',
  REFURB_JOB_STARTED: 'refurb.job_started',
  REFURB_TESTING_STARTED: 'refurb.testing_started',
  REFURB_JOB_COMPLETED: 'refurb.job_completed',
  REFURB_JOB_FAILED: 'refurb.job_failed',
  REFURB_PARTS_USED: 'refurb.parts_used',
  REFURB_LABOR_LOGGED: 'refurb.labor_logged',

  // Post-processing
  ITEM_REFURBISHED: 'item.refurbished',
  ITEM_READY_FOR_LISTING: 'item.ready_for_listing',
} as const;

// ============================================================================
// SALES DOMAIN (QuickListz, QuickBidz, QuickAuctionz)
// ============================================================================

export const SalesEvents = {
  // Listing lifecycle
  LISTING_CREATED: 'listing.created',
  LISTING_PUBLISHED: 'listing.published',
  LISTING_UPDATED: 'listing.updated',
  LISTING_PAUSED: 'listing.paused',
  LISTING_ENDED: 'listing.ended',
  LISTING_SOLD: 'listing.sold',

  // Item listing
  ITEM_LISTED: 'item.listed',
  ITEM_PRICE_UPDATED: 'item.price_updated',
  ITEM_CROSS_LISTED: 'item.cross_listed',

  // Auction lifecycle
  AUCTION_CREATED: 'auction.created',
  AUCTION_SCHEDULED: 'auction.scheduled',
  AUCTION_STARTED: 'auction.started',
  AUCTION_EXTENDED: 'auction.extended',
  AUCTION_ENDED: 'auction.ended',
  AUCTION_CANCELLED: 'auction.cancelled',

  // Bidding
  BID_PLACED: 'bid.placed',
  BID_OUTBID: 'bid.outbid',
  BID_WON: 'bid.won',
  BID_RESERVE_MET: 'bid.reserve_met',

  // Sale completion
  ITEM_SOLD: 'item.sold',
  SALE_COMPLETED: 'sale.completed',
} as const;

// ============================================================================
// OUTBOUND DOMAIN (QuickFulfillment, QuickLoadz, QuickShipz)
// ============================================================================

export const OutboundEvents = {
  // Order lifecycle
  ORDER_CREATED: 'order.created',
  ORDER_IMPORTED: 'order.imported',
  ORDER_PAYMENT_RECEIVED: 'order.payment_received',
  ORDER_PICKING_STARTED: 'order.picking_started',
  ORDER_PICKING_COMPLETED: 'order.picking_completed',
  ORDER_PACKING_STARTED: 'order.packing_started',
  ORDER_PACKING_COMPLETED: 'order.packing_completed',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_RETURNED: 'order.returned',

  // Shipment events
  SHIPMENT_CREATED: 'shipment.created',
  SHIPMENT_LABEL_PRINTED: 'shipment.label_printed',
  SHIPMENT_DISPATCHED: 'shipment.dispatched',
  SHIPMENT_IN_TRANSIT: 'shipment.in_transit',
  SHIPMENT_DELIVERED: 'shipment.delivered',
  SHIPMENT_EXCEPTION: 'shipment.exception',

  // Loading dock
  DOCK_SHIPMENT_ASSIGNED: 'dock.shipment_assigned',
  DOCK_SHIPMENT_DEPARTED: 'dock.shipment_departed',
  DOCK_CARRIER_ARRIVED: 'dock.carrier_arrived',
} as const;

// ============================================================================
// DISPOSITION DOMAIN (QuickSalvage, QuickRecyclez, QuickDiscardz)
// ============================================================================

export const DispositionEvents = {
  // Salvage
  ITEM_MARKED_FOR_SALVAGE: 'item.marked_for_salvage',
  ITEM_PARTS_HARVESTED: 'item.parts_harvested',
  SALVAGE_BULK_LOT_CREATED: 'salvage.bulk_lot_created',
  SALVAGE_BULK_LOT_SOLD: 'salvage.bulk_lot_sold',

  // Recycling
  ITEM_MARKED_FOR_RECYCLING: 'item.marked_for_recycling',
  RECYCLING_BATCH_CREATED: 'recycling.batch_created',
  RECYCLING_PICKUP_SCHEDULED: 'recycling.pickup_scheduled',
  RECYCLING_BATCH_PROCESSED: 'recycling.batch_processed',
  RECYCLING_CERTIFICATE_RECEIVED: 'recycling.certificate_received',

  // Discard
  ITEM_MARKED_FOR_DISCARD: 'item.marked_for_discard',
  DISCARD_APPROVED: 'discard.approved',
  DISCARD_REJECTED: 'discard.rejected',
  ITEM_DISPOSED: 'item.disposed',
  DISCARD_WRITEOFF_GENERATED: 'discard.writeoff_generated',
} as const;

// ============================================================================
// FINANCE DOMAIN (QuickFinancez)
// ============================================================================

export const FinanceEvents = {
  // Transactions
  PAYMENT_RECEIVED: 'payment.received',
  PAYMENT_REFUNDED: 'payment.refunded',
  EXPENSE_RECORDED: 'expense.recorded',

  // Invoicing
  INVOICE_GENERATED: 'invoice.generated',
  INVOICE_SENT: 'invoice.sent',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_OVERDUE: 'invoice.overdue',

  // Consignment payouts
  PAYOUT_CALCULATED: 'payout.calculated',
  PAYOUT_APPROVED: 'payout.approved',
  PAYOUT_PROCESSED: 'payout.processed',
} as const;

// ============================================================================
// INVENTORY DOMAIN (QuickInventoryz)
// ============================================================================

export const InventoryEvents = {
  // Item lifecycle
  ITEM_CREATED: 'item.created',
  ITEM_UPDATED: 'item.updated',
  ITEM_DELETED: 'item.deleted',
  ITEM_STATUS_CHANGED: 'item.status_changed',

  // Location management
  ITEM_LOCATION_CHANGED: 'item.location_changed',
  ITEM_BIN_ASSIGNED: 'item.bin_assigned',

  // Stock levels
  INVENTORY_LOW_STOCK_ALERT: 'inventory.low_stock_alert',
  INVENTORY_OUT_OF_STOCK: 'inventory.out_of_stock',
  INVENTORY_RESTOCKED: 'inventory.restocked',

  // Reservations
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_RESERVATION_RELEASED: 'inventory.reservation_released',

  // Cycle counting
  CYCLE_COUNT_STARTED: 'cycle_count.started',
  CYCLE_COUNT_ITEM_COUNTED: 'cycle_count.item_counted',
  CYCLE_COUNT_COMPLETED: 'cycle_count.completed',
  CYCLE_COUNT_VARIANCE_DETECTED: 'cycle_count.variance_detected',
} as const;

// ============================================================================
// PARTS DOMAIN (QuickPartz)
// ============================================================================

export const PartsEvents = {
  // Parts inventory
  PART_CREATED: 'part.created',
  PART_UPDATED: 'part.updated',
  PART_RESERVED: 'part.reserved',
  PART_USED: 'part.used',
  PART_RETURNED: 'part.returned',

  // Harvesting
  HARVEST_JOB_CREATED: 'harvest.job_created',
  HARVEST_JOB_STARTED: 'harvest.job_started',
  HARVEST_PART_EXTRACTED: 'harvest.part_extracted',
  HARVEST_JOB_COMPLETED: 'harvest.job_completed',

  // Reordering
  PART_LOW_STOCK_ALERT: 'part.low_stock_alert',
  PART_REORDER_TRIGGERED: 'part.reorder_triggered',
} as const;

// ============================================================================
// 3PL DOMAIN (Quick3PLz)
// ============================================================================

export const ThreePLEvents = {
  // Client management
  CLIENT_ONBOARDED: 'client.onboarded',
  CLIENT_SUSPENDED: 'client.suspended',
  CLIENT_ACTIVATED: 'client.activated',

  // Client orders
  CLIENT_ORDER_RECEIVED: 'client_order.received',
  CLIENT_ORDER_FULFILLED: 'client_order.fulfilled',
  CLIENT_ORDER_SHIPPED: 'client_order.shipped',

  // Billing
  CLIENT_BILLING_INVOICE_GENERATED: 'client_billing.invoice_generated',
  CLIENT_BILLING_PAYMENT_RECEIVED: 'client_billing.payment_received',
} as const;

// ============================================================================
// CONSIGNMENT DOMAIN (QuickConsignmentz)
// ============================================================================

export const ConsignmentEvents = {
  // Consignor management
  CONSIGNOR_REGISTERED: 'consignor.registered',
  CONSIGNOR_UPDATED: 'consignor.updated',

  // Consignment items
  CONSIGNMENT_ITEM_RECEIVED: 'consignment_item.received',
  CONSIGNMENT_ITEM_LISTED: 'consignment_item.listed',
  CONSIGNMENT_ITEM_SOLD: 'consignment_item.sold',
  CONSIGNMENT_ITEM_RETURNED: 'consignment_item.returned',

  // Payouts
  CONSIGNMENT_PAYOUT_PENDING: 'consignment_payout.pending',
  CONSIGNMENT_PAYOUT_PROCESSED: 'consignment_payout.processed',
} as const;

// ============================================================================
// SUPPLIER DOMAIN (QuickSupplyz)
// ============================================================================

export const SupplierEvents = {
  // Supplier management
  SUPPLIER_CREATED: 'supplier.created',
  SUPPLIER_UPDATED: 'supplier.updated',
  SUPPLIER_RATED: 'supplier.rated',

  // Purchase orders
  PURCHASE_ORDER_CREATED: 'purchase_order.created',
  PURCHASE_ORDER_SUBMITTED: 'purchase_order.submitted',
  PURCHASE_ORDER_CONFIRMED: 'purchase_order.confirmed',
  PURCHASE_ORDER_RECEIVED: 'purchase_order.received',
  PURCHASE_ORDER_CANCELLED: 'purchase_order.cancelled',
} as const;

// ============================================================================
// SYSTEM EVENTS (QuickAuthz, API Gateway)
// ============================================================================

export const SystemEvents = {
  // Authentication
  USER_LOGGED_IN: 'user.logged_in',
  USER_LOGGED_OUT: 'user.logged_out',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_PERMISSION_CHANGED: 'user.permission_changed',

  // System health
  SERVICE_STARTED: 'service.started',
  SERVICE_STOPPED: 'service.stopped',
  SERVICE_HEALTH_CHECK_FAILED: 'service.health_check_failed',
} as const;

// ============================================================================
// COMBINED EXPORT
// ============================================================================

export const AllEvents = {
  ...InboundEvents,
  ...ProcessingEvents,
  ...SalesEvents,
  ...OutboundEvents,
  ...DispositionEvents,
  ...FinanceEvents,
  ...InventoryEvents,
  ...PartsEvents,
  ...ThreePLEvents,
  ...ConsignmentEvents,
  ...SupplierEvents,
  ...SystemEvents,
} as const;

export type EventType = (typeof AllEvents)[keyof typeof AllEvents];

/**
 * Get the domain from an event type
 */
export function getEventDomain(eventType: string): string {
  const [domain] = eventType.split('.');
  return domain ?? 'unknown';
}

/**
 * Get the stream key for an event type (for Redis Streams partitioning)
 */
export function getStreamKeyForEvent(eventType: string, prefix = 'quickwms:events:'): string {
  const domain = getEventDomain(eventType);
  return `${prefix}${domain}`;
}
