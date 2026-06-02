export function useDebounce(fn: () => void, delay = 300) {
  let timer: number | undefined
  return () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(fn, delay)
  }
}
