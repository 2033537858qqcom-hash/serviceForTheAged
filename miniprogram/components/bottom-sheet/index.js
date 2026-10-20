const { sheetDelta, sheetShouldClose } = require('../../utils/sheet-gesture.js');

Component({
  options: { styleIsolation: 'apply-shared' },
  properties: {
    show: { type: Boolean, value: false },
    title: { type: String, value: '' },
    content: { type: String, value: '' },
    confirmText: { type: String, value: '' },
    dismissText: { type: String, value: '再想想' },
    tone: { type: String, value: '' }
  },
  data: { rendered: false, drag: 0 },
  observers: {
    show(show) {
      if (show) {
        this._opened = true;
        this.setData({ rendered: true, drag: 420 }, () => this.setData({ drag: 0 }));
        return;
      }
      if (this._opened && this.data.rendered) this.finishClose();
    }
  },
  methods: {
    noop() {},
    onMask() { this.triggerEvent('close'); },
    onConfirm() { this.triggerEvent('confirm'); },
    onStart(event) {
      const touch = event.touches && event.touches[0];
      if (!touch) return;
      this._startY = touch.clientY;
      this._startAt = Date.now();
    },
    onMove(event) {
      const touch = event.touches && event.touches[0];
      if (!touch || this._startY == null) return;
      this.setData({ drag: sheetDelta(this._startY, touch.clientY) });
    },
    onEnd() {
      if (this._startY == null) return;
      const delta = this.data.drag;
      const elapsed = Date.now() - this._startAt;
      this._startY = null;
      if (sheetShouldClose(delta, elapsed, 420)) this.triggerEvent('close');
      else this.setData({ drag: 0 });
    },
    finishClose() {
      this._opened = false;
      this.setData({ drag: 640 });
      setTimeout(() => this.setData({ rendered: false, drag: 0 }), 280);
    }
  }
});
