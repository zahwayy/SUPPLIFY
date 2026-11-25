import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../lib/auth/rbac.js';
import { getShipmentsForUser } from '../../../modules/purchase-orders/poService.js';
import ShipmentManager from '../../../components/purchase-orders/ShipmentManager.jsx';

export const dynamic = 'force-dynamic';

export default async function ShipmentHistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (!hasPermission(user, PERMISSIONS.SHIPMENT_READ_OWN)) {
    redirect('/unauthorized');
  }

  const all = await getShipmentsForUser(user);
  const history = all.filter((s) =>
    ['in_transit', 'delivered', 'received', 'completed'].includes(s.po_status)
  );

  return (
    <ShipmentManager
      title="Shipment History"
      description="Riwayat pengiriman Purchase Order perusahaan Anda beserta nomor resi dan status penerimaan gudang."
      shipments={history}
      emptyTitle="Belum Ada Riwayat Pengiriman"
      emptyDescription="Riwayat pengiriman akan tampil setelah Anda mengirimkan data shipment pada PO terkonfirmasi."
    />
  );
}
