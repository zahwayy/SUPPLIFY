export const TRANSACTION_TYPES = Object.freeze({
  INCOMING: 'incoming',
  OUTGOING: 'outgoing',
});

export const TRANSACTION_STATUSES = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
});

export const PO_STATUSES = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  IN_TRANSIT: 'in_transit',
  INSPECTING: 'inspecting',
  RECEIVED: 'received',
  RETURNED: 'returned',
  // Legacy statuses kept read-compatible for historical rows
  PROCESSING: 'processing',
  PREPARING: 'preparing',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

export const INCOMING_DISCREPANCY_ACTIONS = Object.freeze({
  NONE: 'none',
  REFUND_CLAIM: 'refund_claim',
  CREATE_NEW_PO: 'create_new_po',
  RETURN_TO_SUPPLIER: 'return_to_supplier',
  REJECT_DAMAGED: 'reject_damaged',
  FOLLOW_UP_SUPPLIER: 'follow_up_supplier',
  CLOSE_SHORTAGE: 'close_shortage',
});

export const REFUND_CLAIM_STATUSES = Object.freeze({
  NONE: 'none',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
});

export const DISCREPANCY_STATUSES = Object.freeze({
  OPEN: 'open',
  INVESTIGATING: 'investigating',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
});

export const SUPPLIER_APPEAL_STATUSES = Object.freeze({
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

export const STOCK_STATUSES = Object.freeze({
  OUT_OF_STOCK: 'Out of Stock',
  SEVERE: 'Severe',
  LOW: 'Low',
  NORMAL: 'Normal',
});

// MVP evidence scope (Phase 1 foundation + supplier arrival proof)
export const EVIDENCE_ENTITY_TYPES = Object.freeze({
  INCOMING_INSPECTION: 'incoming_inspection',
  SUPPLIER_SHIPMENT: 'supplier_shipment',
  SUPPLIER_ARRIVAL: 'supplier_arrival',
  OUTGOING_HANDOVER: 'outgoing_handover',
  DISCREPANCY: 'discrepancy',
});
