import { JsMonitor } from './js-monitor'

const monitor = new JsMonitor()

let s
if ((s = document.currentScript)) {
  const { pid, report } = s.dataset
  if (pid && report) {
    monitor.config({ pid, reportUrl: report })
  }
}

export default monitor
