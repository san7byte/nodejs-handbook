import { EventEmitter, errorMonitor } from 'node:events';

class OrderService extends EventEmitter {
  constructor() {
    super();
    // Menetapkan kuota listener aman untuk instance domain service
    this.setMaxListeners(10);
  }

  processCheckout(orderId, customerEmail, amount) {
    if (!orderId || amount <= 0) {
      this.emit(
        'error',
        new Error(`Invalid checkout payload for order ${orderId}`),
      );
      return false;
    }

    console.log(`[OrderService] Checkout initiated for ${orderId}`);
    this.emit('order:created', {
      orderId,
      customerEmail,
      amount,
      timestamp: Date.now(),
    });
    return true;
  }
}

const orderService = new OrderService();

// 1. Audit logger: Dipasang di posisi terdepan dengan prioritas tinggi
orderService.prependListener('order:created', (order) => {
  console.log(
    `[Audit Trail] High-priority ledger recorded: ${order.orderId} ($${order.amount})`,
  );
});

// 2. Email notification handler: Berjalan secara terpisah
orderService.on('order:created', (order) => {
  console.log(
    `[Notification Service] Confirmation email dispatched to ${order.customerEmail}`,
  );
});

// 3. Inventory allocation: Mengurangi stok barang
orderService.on('order:created', (order) => {
  console.log(`[Inventory Service] Stock reserved for order ${order.orderId}`);
});

// 4. Centralized telemetry monitoring: Mengamati error tanpa mengonsumsinya
orderService.on(errorMonitor, (err) => {
  console.log(`[Telemetry Monitor] Alert logged to APM: ${err.message}`);
});

// 5. Error handling listener: Menjaga stabilitas proses dari unhandled crash
orderService.on('error', (err) => {
  console.log(`[Error Boundary] Safe recovery for failure: ${err.message}`);
});

// Skenario 1: Checkout pesanan valid
console.log('--- Successful Checkout ---');
orderService.processCheckout('ORD-0001', 'customer@example.com', 150);
orderService.processCheckout('ORD-0002', 'customer2@example.com', 40);
orderService.processCheckout('ORD-0003', 'customer3@example.com', 500);

// Skenario 2: Checkout pesanan tidak valid yang memicu event error
console.log('--- Failed Checkout ---');
orderService.processCheckout('ORD-ERR', 'invalid@example.com', -20);
