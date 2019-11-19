import 'mocha'
import { expect } from 'chai'
import { AnyAction, createStore } from 'redux'
import { getStoredState, installStorageWriter } from '../../src'

const ROOT_KEY = 'my-state'

describe('getStoredState', () => {
    it('should return undefined if no localStorage exists', () => {
        (global as any).window = {}
        const result = getStoredState([], ROOT_KEY)
        expect(result).to.be.undefined
    })

    it('should return undefined if the root key does not exist', () => {
        createFakeWindow(null)
        const result = getStoredState([], 'WRONG_KEY')
        expect(result).to.be.undefined
    })

    it('should return undefined if no substate key matches', () => {
        createFakeWindow({ foo: 123 })
        const result = getStoredState(['bar'], ROOT_KEY)
        expect(result).to.be.undefined
    })

    it('should get the state from local storage', () => {
        createFakeWindow({ foo: 124, bar: 456, baz: 789 })
        const result = getStoredState(['foo', 'baz'], ROOT_KEY)
        expect(result).to.eql({ foo: 124, baz: 789 })
    })
})

describe('installStorageWriter', () => {
    it('should copy selected substate to local storage', () => {
        const actionType = 'MY_ACTION'
        const reducer = (s: any, a: AnyAction) => a.type === actionType ? a.state : s
        const store = createStore(reducer)
        const localStorage = createFakeWindow(null)
        installStorageWriter(store, ['foo', 'baz'], ROOT_KEY)

        store.dispatch({ type: actionType, state: { foo: 124, bar: 456, baz: 789 } })

        const result = localStorage.getItem(ROOT_KEY)
        expect(JSON.parse(result || '')).to.eql({ foo: 124, baz: 789 })
        expect(localStorage.getWriteCount()).to.equal(1)
    })

    it('should memoize selected substate', () => {
        const actionType = 'MY_ACTION'
        const reducer = (s: any, a: AnyAction) => a.type === actionType ? Object.assign({}, a.state, s) : s
        const store = createStore(reducer)
        const localStorage = createFakeWindow(null)
        installStorageWriter(store, ['foo', 'baz'], ROOT_KEY)

        // Only the first and last actions lead to storage updates.
        // The 2nd one is ignored because the value did not change.
        // The 3rd one is ignored because its key is not in the filter list.
        store.dispatch({ type: actionType, state: { foo: 124 } })
        store.dispatch({ type: actionType, state: { foo: 124 } })
        store.dispatch({ type: actionType, state: { bar: 456 } })
        store.dispatch({ type: actionType, state: { baz: 789 } })

        const result = localStorage.getItem(ROOT_KEY)
        expect(JSON.parse(result || '')).to.eql({ foo: 124, baz: 789 })
        expect(localStorage.getWriteCount()).to.equal(2)
    })
})

class LocalStorageMock {
    private readonly store: { [k: string]: string }
    private writeCount: number
    constructor(initialState: Object | null) {
        this.store = initialState ? { [ROOT_KEY]: JSON.stringify(initialState) } : {}
        this.writeCount = 0
    }
    getItem(key: string): string | null {
        return this.store[key] || null
    }
    setItem(key: string, value: string) {
        this.store[key] = value
        ++this.writeCount
    }
    getWriteCount() {
        return this.writeCount
    }
}

const createFakeWindow = (initialState: Object | null): LocalStorageMock => {
    const localStorage = new LocalStorageMock(initialState)
    ;(global as any).window = { localStorage }
    return localStorage
}
