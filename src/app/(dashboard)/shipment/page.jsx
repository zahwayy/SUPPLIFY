import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../lib/auth/rbac.js';
import { getShipmentsForUser } from '../../../modules/purchase-orders/poService.js';
import ShipmentManager from '../../../components/purchase-orders/ShipmentManager.jsx';

export const dynamic = 'force-dynamic';

export default async function ShipmentPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (!hasPermission(user, PERMISSIONS.SHIPMENT_MANAGE_OWN)) {
    redirect('/unauthorized');
  }

  const all = await getShipmentsForUser(user);
  const activeShipments = all.filter((s) =>
    ['processing', 'confirmed', 'preparing', 'in_transit'].includes(s.po_status)
  );

  return (
    <ShipmentManager
      title="Shipment Submission"
      description="Pilih Purchase Order yang telah dikonfirmasi untuk mengisi detail kurir, nomor resi, dan bukti pengiriman."
      shipments={activeShipments}
      emptyTitle="Belum Ada PO yang Perlu Dikirim"
      emptyDescription="Konfirmasi Purchase Order terlebih dahulu di halaman Purchase Orders untuk mulai mengirim barang."
    />
  );
}
