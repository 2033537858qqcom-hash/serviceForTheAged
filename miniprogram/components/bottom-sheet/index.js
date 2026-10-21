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
  data: { rendered: false, drag: 0, dragging: false },
  lifetimes: {
    detached() { clearTimeout(this._closeTimer); }
  },
  observers: {
    show(show) {
      clearTimeout(this._closeTimer);
      this._startY = null;
      if (show) {
        this._opened = true;
        this.setData({ rendered: true, dragging: false, drag: 420 }, () => this.setData({ drag: 0 }));
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
      this.setData({ dragging: true });
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
      this.setData({ dragging: false });
      if (sheetShouldClose(delta, elapsed, 420)) this.triggerEvent('close');
      else this.setData({ drag: 0 });
    },
    finishClose() {
      this._opened = false;
      clearTimeout(this._closeTimer);
      this.setData({ drag: 640, dragging: false });
      this._closeTimer = setTimeout(() => {
        if (!this._opened) this.setData({ rendered: false, drag: 0 });
      }, 280);
    },
    onCancel() {
      this._startY = null;
      this.setData({ drag: 0, dragging: false });
    }
  }
});
