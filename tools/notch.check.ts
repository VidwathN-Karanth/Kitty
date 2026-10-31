// Checks the closed-island balancing. Run: node tools/notch.check.ts
import assert from 'node:assert/strict'
import { arrange, balance, NOTCH_ITEMS, type NotchItem } from '../src/notch.ts'

const w = (k: NotchItem) => NOTCH_ITEMS[k].w
const width = (l: NotchItem[]) => l.reduce((a, k) => a + w(k), 0) + Math.max(0, l.length - 1) * 8

// no song: everything starts on the left, so some of it moves right; the items next to the cat stay
const auto = { notchMode: 'auto', notchLeft: [], notchRight: [] }
const a = arrange(auto, ['wifi', 'bt', 'speaker', 'cpu', 'ram', 'gpu', 'battery', 'light'], w)
assert.deepEqual(a.left.slice(-1), ['gpu'], 'GPU (next to the cat) stays on the left')
assert.equal(a.right[0], 'battery', 'battery stays next to the cat on the right')
assert.ok(Math.abs(width(a.left) - width(a.right)) < 60, `sides roughly even: ${width(a.left)} vs ${width(a.right)}`)
assert.ok(a.right.length > 2, 'something moved over to the right')

// already even: nothing moves
assert.deepEqual(balance(['cpu'], ['battery'], w), { left: ['cpu'], right: ['battery'] })

// custom: the user's order wins; an item that is not placed yet goes to its usual side
const c = arrange({ notchMode: 'custom', notchLeft: ['battery'], notchRight: ['cpu', 'wifi'] }, ['battery', 'cpu', 'wifi', 'ram'], w)
assert.deepEqual(c, { left: ['ram', 'battery'], right: ['cpu', 'wifi'] })

console.log('notch checks passed', a)
