import { query } from '../../lib/db/pool.js';
import { ROLES } from '../../lib/constants/roles.js';
import { logError } from '../../lib/utils/logger.js';

export async function getDashboardDataForUser(user) {
  try {
    if (user.role === ROLES.ADMIN) {
      const [supRes, appealRes, userRes, prodRes, catRes, pendingSupList, recentAudit] =
        await Promise.all([
          query(`
            SELECT
              COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_suppliers,
              COUNT(*) FILTER (WHERE status = 'active')::int AS active_suppliers,
              COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_suppliers
            FROM users
            WHERE role = 'supplier'
          `),
          query(`
            SELECT
              COUNT(*) FILTER (WHERE status IN ('submitted', 'under_review'))::int AS pending_appeals
            FROM supplier_appeals
          `),
          query(`
            SELECT
              COUNT(*) FILTER (WHERE status = 'active')::int AS total_users,
              COUNT(*) FILTER (WHERE status = 'inactive')::int AS inactive_users
            FROM users
          `),
          query(
            `SELECT
               COUNT(*)::int AS total_products,
               COALESCE(SUM(stock), 0)::int AS total_stock_units,
               COUNT(*) FILTER (WHERE stock = 0)::int AS out_of_stock,
               COUNT(*) FILTER (WHERE stock > 0 AND minimum_stock IS NOT NULL AND stock <= minimum_stock)::int AS severe_stock,
               COUNT(*) FILTER (
                 WHERE stock > 0
                   AND minimum_stock IS NOT NULL
                   AND low_stock_threshold IS NOT NULL
                   AND stock > minimum_stock
                   AND stock <= low_stock_threshold
               )::int AS low_stock,
               COALESCE(SUM(stock * COALESCE(purchase_price, 0)), 0)::numeric(14, 2) AS estimated_value
             FROM products
             WHERE deleted_at IS NULL`
          ),
          query(`SELECT COUNT(*)::int AS total_categories FROM categories`),
          query(`
            SELECT s.id, u.name, u.email, u.status, u.created_at, s.company_name, s.contact_name, s.phone
            FROM users u
            INNER JOIN suppliers s ON s.user_id = u.id
            WHERE u.role = 'supplier'
            ORDER BY (u.status = 'pending') DESC, u.created_at DESC
            LIMIT 6
          `),
          query(`
            SELECT al.id, al.action, al.entity_type, al.actor_role, al.created_at, u.name AS actor_name
            FROM audit_logs al
            LEFT JOIN users u ON u.id = al.actor_id
            ORDER BY al.created_at DESC
            LIMIT 6
          `),
        ]);

      return {
        dbConnected: true,
        metrics: {
          pendingSuppliers: supRes.rows[0]?.pending_suppliers ?? 0,
          pendingAppeals: appealRes.rows[0]?.pending_appeals ?? 0,
          activeSuppliers: supRes.rows[0]?.active_suppliers ?? 0,
          rejectedSuppliers: supRes.rows[0]?.rejected_suppliers ?? 0,
          totalUsers: userRes.rows[0]?.total_users ?? 0,
          inactiveUsers: userRes.rows[0]?.inactive_users ?? 0,
          totalProducts: prodRes.rows[0]?.total_products ?? 0,
          totalStockUnits: prodRes.rows[0]?.total_stock_units ?? 0,
          estimatedValue: prodRes.rows[0]?.estimated_value ?? 0,
          outOfStock: prodRes.rows[0]?.out_of_stock ?? 0,
          severeStock: prodRes.rows[0]?.severe_stock ?? 0,
          lowStock: prodRes.rows[0]?.low_stock ?? 0,
          totalCategories: catRes.rows[0]?.total_categories ?? 0,
        },
        recentRows: pendingSupList.rows,
        secondaryRows: recentAudit.rows,
        actionRows: [],
      };
    }

    if (user.role === ROLES.MANAGER) {
      const [
        prodRes,
        txRes,
        poRes,
        discRes,
        adjRes,
        pendingTxList,
        recentMovements,
        lowStockItems,
      ] = await Promise.all([
        query(`
          SELECT
            COUNT(*)::int AS total_products,
            COALESCE(SUM(stock), 0)::int AS total_stock_units,
            COUNT(*) FILTER (WHERE stock = 0)::int AS out_of_stock,
            COUNT(*) FILTER (WHERE stock > 0 AND minimum_stock IS NOT NULL AND stock <= minimum_stock)::int AS severe_stock,
            COUNT(*) FILTER (
              WHERE stock > 0
                AND minimum_stock IS NOT NULL
                AND low_stock_threshold IS NOT NULL
                AND stock > minimum_stock
                AND stock <= low_stock_threshold
            )::int AS low_stock,
            COALESCE(SUM(stock * COALESCE(purchase_price, 0)), 0)::numeric(14, 2) AS estimated_value
          FROM products
          WHERE deleted_at IS NULL
        `),
        query(`
          SELECT
            COUNT(*) FILTER (WHERE type = 'incoming' AND status = 'pending')::int AS pending_incoming,
            COUNT(*) FILTER (WHERE type = 'outgoing' AND status = 'pending')::int AS pending_outgoing
          FROM transactions
        `),
        query(`
          SELECT
            COUNT(*) FILTER (WHERE status IN ('pending','confirmed','processing','preparing','in_transit','inspecting','delivered'))::int AS active_pos,
            COUNT(*) FILTER (WHERE status = 'in_transit')::int AS arrival_awaiting_staff,
            COUNT(*) FILTER (WHERE status = 'in_transit')::int AS in_transit_pos,
            COUNT(*) FILTER (WHERE status = 'inspecting')::int AS inspecting_pos
          FROM purchase_orders
        `),
        query(
          `SELECT COUNT(*)::int AS open_discrepancies FROM discrepancy_reports WHERE status IN ('open','investigating')`
        ),
        query(
          `SELECT COUNT(*)::int AS pending_adjustments FROM stock_adjustments WHERE status = 'pending'`
        ),
        query(`
          SELECT
            t.id,
            t.transaction_code,
            t.type,
            t.status,
            t.transaction_date,
            u.name AS created_by_name,
            COUNT(ti.id)::int AS item_count,
            COALESCE(SUM(ti.quantity), 0)::int AS total_quantity
          FROM transactions t
          INNER JOIN users u ON u.id = t.created_by
          LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
          GROUP BY t.id, u.name
          ORDER BY (t.status = 'pending') DESC, t.transaction_date DESC
          LIMIT 6
        `),
        query(`
          SELECT
            sm.id,
            sm.product_id,
            sm.transaction_id,
            t.type AS transaction_type,
            t.transaction_code,
            sm.stock_adjustment_id,
            sa.adjustment_code,
            sm.movement_type,
            sm.quantity_delta,
            sm.stock_before,
            sm.stock_after,
            sm.created_at,
            p.sku,
            p.name AS product_name,
            p.unit
          FROM stock_movements sm
          INNER JOIN products p ON p.id = sm.product_id
          LEFT JOIN transactions t ON t.id = sm.transaction_id
          LEFT JOIN stock_adjustments sa ON sa.id = sm.stock_adjustment_id
          ORDER BY sm.created_at DESC, sm.id DESC
          LIMIT 6
        `),
        query(`
          SELECT id, sku, name, stock, minimum_stock, low_stock_threshold, unit
          FROM products
          WHERE deleted_at IS NULL
            AND (
              stock = 0
              OR (minimum_stock IS NOT NULL AND stock <= minimum_stock)
              OR (minimum_stock IS NOT NULL AND low_stock_threshold IS NOT NULL AND stock <= low_stock_threshold)
            )
          ORDER BY (stock = 0) DESC, (stock > 0 AND minimum_stock IS NOT NULL AND stock <= minimum_stock) DESC, stock ASC, name ASC
          LIMIT 6
        `),
      ]);

      const pendingIncoming = txRes.rows[0]?.pending_incoming ?? 0;
      const pendingOutgoing = txRes.rows[0]?.pending_outgoing ?? 0;

      return {
        dbConnected: true,
        metrics: {
          totalProducts: prodRes.rows[0]?.total_products ?? 0,
          totalStockUnits: prodRes.rows[0]?.total_stock_units ?? 0,
          estimatedValue: prodRes.rows[0]?.estimated_value ?? 0,
          outOfStock: prodRes.rows[0]?.out_of_stock ?? 0,
          severeStock: prodRes.rows[0]?.severe_stock ?? 0,
          lowStock: prodRes.rows[0]?.low_stock ?? 0,
          pendingIncoming,
          pendingOutgoing,
          pendingApprovals: pendingIncoming + pendingOutgoing,
          activePurchaseOrders: poRes.rows[0]?.active_pos ?? 0,
          deliveredAwaitingReceived: poRes.rows[0]?.arrival_awaiting_staff ?? 0,
          inTransitPos: poRes.rows[0]?.in_transit_pos ?? 0,
          inspectingPos: poRes.rows[0]?.inspecting_pos ?? 0,
          openDiscrepancies: discRes.rows[0]?.open_discrepancies ?? 0,
          pendingAdjustments: adjRes.rows[0]?.pending_adjustments ?? 0,
        },
        recentRows: pendingTxList.rows,
        secondaryRows: recentMovements.rows,
        actionRows: lowStockItems.rows,
      };
    }

    if (user.role === ROLES.STAFF) {
      const [txRes, poRes, discRes, myTxList, eligiblePos, readyHandovers] =
        await Promise.all([
          query(
            `SELECT
               COUNT(*) FILTER (WHERE status = 'pending')::int AS my_pending,
               COUNT(*) FILTER (WHERE type = 'outgoing' AND status = 'approved')::int AS ready_for_handover
             FROM transactions
             WHERE created_by = $1`,
            [user.id]
          ),
          query(`
            SELECT
              COUNT(*) FILTER (WHERE po.status IN ('in_transit', 'inspecting', 'returned'))::int AS receivable_pos,
              COUNT(*) FILTER (
                WHERE po.status IN ('inspecting', 'returned')
                  AND active_inc.id IS NULL
              )::int AS ready_for_incoming
            FROM purchase_orders po
            LEFT JOIN transactions active_inc
              ON active_inc.purchase_order_id = po.id
              AND active_inc.type = 'incoming'
              AND active_inc.status IN ('pending', 'approved')
          `),
          query(
            `SELECT COUNT(*)::int AS my_discrepancies FROM discrepancy_reports WHERE reported_by = $1`,
            [user.id]
          ),
          query(
            `SELECT
               t.id,
               t.transaction_code,
               t.type,
               t.status,
               t.transaction_date,
               COUNT(ti.id)::int AS item_count,
               COALESCE(SUM(ti.quantity), 0)::int AS total_quantity
             FROM transactions t
             LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
             WHERE t.created_by = $1
             GROUP BY t.id
             ORDER BY t.transaction_date DESC
             LIMIT 6`,
            [user.id]
          ),
          query(`
            SELECT
              po.id,
              po.po_code,
              po.inspection_requested_at,
              s.company_name AS supplier_name,
              COUNT(poi.id)::int AS item_count,
              COALESCE(SUM(poi.quantity), 0)::int AS total_quantity
            FROM purchase_orders po
            INNER JOIN suppliers s ON s.id = po.supplier_id
            LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
            LEFT JOIN transactions active_inc
              ON active_inc.purchase_order_id = po.id
              AND active_inc.type = 'incoming'
              AND active_inc.status IN ('pending', 'approved')
            WHERE po.status IN ('inspecting', 'returned')
              AND active_inc.id IS NULL
            GROUP BY po.id, s.company_name
            ORDER BY COALESCE(po.inspection_requested_at, po.updated_at) DESC, po.id DESC
            LIMIT 5
          `),
          query(`
            SELECT
              t.id,
              t.transaction_code,
              t.processed_at,
              t.notes,
              COUNT(ti.id)::int AS item_count,
              COALESCE(SUM(ti.quantity), 0)::int AS total_quantity
            FROM transactions t
            LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
            WHERE t.type = 'outgoing' AND t.status = 'approved'
            GROUP BY t.id
            ORDER BY t.processed_at DESC NULLS LAST, t.id DESC
            LIMIT 5
          `),
        ]);

      return {
        dbConnected: true,
        metrics: {
          myPendingTransactions: txRes.rows[0]?.my_pending ?? 0,
          readyForHandover: txRes.rows[0]?.ready_for_handover ?? 0,
          receivablePurchaseOrders: poRes.rows[0]?.receivable_pos ?? 0,
          readyForIncoming: poRes.rows[0]?.ready_for_incoming ?? 0,
          myDiscrepancies: discRes.rows[0]?.my_discrepancies ?? 0,
        },
        recentRows: myTxList.rows,
        secondaryRows: readyHandovers.rows,
        actionRows: eligiblePos.rows,
      };
    }

    // Supplier (strictly scoped by user.supplierId)
    if (user.role === ROLES.SUPPLIER && user.supplierId) {
      const [poRes, ownPoList] = await Promise.all([
        query(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_confirmation,
             COUNT(*) FILTER (WHERE status IN ('confirmed','processing','preparing'))::int AS awaiting_shipment,
             COUNT(*) FILTER (WHERE status IN ('in_transit','inspecting'))::int AS in_transit,
             COUNT(*) FILTER (WHERE status IN ('received','returned','completed','delivered'))::int AS completed_orders
           FROM purchase_orders
           WHERE supplier_id = $1`,
          [user.supplierId]
        ),
        query(
          `SELECT
             po.id,
             po.po_code,
             po.status,
             po.order_date,
             po.expected_arrival,
             sd.courier_name,
             sd.tracking_number,
             COUNT(poi.id)::int AS item_count,
             COALESCE(SUM(poi.quantity), 0)::int AS total_quantity
           FROM purchase_orders po
           LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
           LEFT JOIN shipment_details sd ON sd.purchase_order_id = po.id
           WHERE po.supplier_id = $1
           GROUP BY po.id, sd.courier_name, sd.tracking_number
           ORDER BY (po.status = 'pending') DESC, (po.status IN ('processing','confirmed','preparing')) DESC, po.order_date DESC, po.id DESC
           LIMIT 8`,
          [user.supplierId]
        ),
      ]);

      return {
        dbConnected: true,
        metrics: {
          pendingConfirmation: poRes.rows[0]?.pending_confirmation ?? 0,
          awaitingShipment: poRes.rows[0]?.awaiting_shipment ?? 0,
          inTransit: poRes.rows[0]?.in_transit ?? 0,
          completedOrders: poRes.rows[0]?.completed_orders ?? 0,
        },
        recentRows: ownPoList.rows,
        secondaryRows: [],
        actionRows: ownPoList.rows.filter((r) =>
          ['pending', 'processing', 'confirmed', 'preparing'].includes(r.status)
        ),
      };
    }

    return { dbConnected: true, metrics: {}, recentRows: [], secondaryRows: [], actionRows: [] };
  } catch (err) {
    logError('dashboardService.getDashboardDataForUser', err);
    return {
      dbConnected: false,
      metrics: null,
      recentRows: [],
      secondaryRows: [],
      actionRows: [],
    };
  }
}
