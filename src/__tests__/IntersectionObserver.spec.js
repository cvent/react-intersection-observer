/* eslint-env jest */
import 'intersection-observer';
import React from 'react';
import renderer from 'react-test-renderer';
import IntersectionObserver from '../IntersectionObserver';
import { callback, findObserverElement, observerElementsMap } from '../observer';

function mockUtilsFunctions() {
    const utils = require.requireActual('../utils');
    return {
        ...utils,
        isDOMTypeElement() {
            return true;
        },
    };
}

jest.mock('../utils', () => mockUtilsFunctions());

const noop = () => {};
const target = { nodeType: 1 };
const propTypes = IntersectionObserver.propTypes;

beforeAll(() => {
    IntersectionObserver.propTypes = {};
});

afterAll(() => {
    IntersectionObserver.propTypes = propTypes;
});

afterEach(() => {
    observerElementsMap.clear();
});

test('throws when the property children is not an only child', () => {
    global.spyOn(console, 'error');
    const component = (
        <IntersectionObserver onChange={noop}>
            <span />
            <span />
        </IntersectionObserver>
    );
    expect(() => renderer.create(component)).toThrowErrorMatchingSnapshot();
});

test('throws on mount if children is StatelessComponent in React 15', () => {
    global.spyOn(console, 'error');
    const { version } = React;
    const StatelessComponent = () => <span />;
    const component = (
        <IntersectionObserver onChange={noop}>
            <StatelessComponent />
        </IntersectionObserver>
    );

    React.version = '15.4.0';
    expect(() => renderer.create(component)).toThrowErrorMatchingSnapshot();
    React.version = version;
});

test('should call ref callback of children', () => {
    const spy = jest.fn();
    const component = (
        <IntersectionObserver onChange={noop}>
            <span ref={spy} />
        </IntersectionObserver>
    );

    renderer.create(component, { createNodeMock: () => target });

    expect(spy).toHaveBeenCalledWith(target);
});

test('should handle children ref of type RefObject', () => {
    const ref = React.createRef();
    const component = (
        <IntersectionObserver onChange={noop}>
            <span ref={ref} />
        </IntersectionObserver>
    );

    renderer.create(component, { createNodeMock: () => target });

    expect(ref.current).toEqual(target);
});

test('options getter returns propTypes `root`, `rootMargin` and `threshold`', () => {
    const options = { root: { nodeType: 1 }, rootMargin: '50% 0%', threshold: [0, 1] };
    const component = (
        <IntersectionObserver onChange={noop} {...options}>
            <span />
        </IntersectionObserver>
    );

    const tree = renderer.create(component, { createNodeMock: () => target });

    expect(tree.getInstance().options).toEqual(options);
});

test("should save target in the observer targets' list on mount", () => {
    const component = (
        <IntersectionObserver onChange={noop}>
            <span />
        </IntersectionObserver>
    );
    const tree = renderer.create(component, { createNodeMock: () => target });
    const observer = tree.getInstance().observer;
    const retrieved = findObserverElement(observer, { target });

    expect(retrieved).toEqual(tree.getInstance());
});

test("should remove target from the observer targets' list on umount", () => {
    const component = (
        <IntersectionObserver onChange={noop}>
            <span />
        </IntersectionObserver>
    );
    const tree = renderer.create(component, { createNodeMock: () => target });
    const instance = tree.getInstance();
    const observer = instance.observer;
    tree.unmount();
    const retrieved = findObserverElement(observer, { target });

    expect(retrieved).toBeNull();
});

describe('update', () => {
    test('componentDidUpdate reobserves the target with observer prop changes', () => {
        const component = (
            <IntersectionObserver onChange={noop}>
                <span />
            </IntersectionObserver>
        );
        const tree = renderer.create(component, { createNodeMock: () => target });
        const instance = tree.getInstance();

        const spy1 = jest.spyOn(instance, 'observe');
        const spy2 = jest.spyOn(instance, 'unobserve');

        tree.update(
            <IntersectionObserver onChange={noop} rootMargin="20% 10%">
                <span />
            </IntersectionObserver>,
        );
        expect(spy1).toHaveBeenCalledTimes(1);
        expect(spy2).toHaveBeenCalledTimes(1);
    });

    test('should cleanup when tree reconciliation has led to a full rebuild', () => {
        const component = (
            <IntersectionObserver onChange={noop}>
                <span />
            </IntersectionObserver>
        );
        let called = false;
        const tree = renderer.create(component, {
            createNodeMock() {
                if (called) {
                    return target;
                }
                called = true;
                return Object.assign({ id: 2 }, target);
            },
        });
        const instance = tree.getInstance();
        const spy1 = jest.spyOn(instance, 'unobserve');
        const spy2 = jest.spyOn(instance, 'observe');

        tree.update(
            <IntersectionObserver onChange={noop}>
                <span />
            </IntersectionObserver>,
        );

        tree.update(
            <IntersectionObserver onChange={noop}>
                <div />
            </IntersectionObserver>,
        );

        expect(spy1).toHaveBeenCalledTimes(1);
        expect(spy2).toHaveBeenCalledTimes(1);
        expect(instance.target).toBe(target);
    });

    test('should reobserve with new root, rootMargin and/or threshold props', () => {
        const root1 = Object.assign({ id: 'window' }, target);
        const root2 = Object.assign({ id: 'document' }, target);
        const initialProps = {
            onChange: noop,
            root: root1,
            rootMargin: '10% 20%',
            threshold: 0.5,
        };
        const component = (
            <IntersectionObserver {...initialProps}>
                <span />
            </IntersectionObserver>
        );
        const tree = renderer.create(component, { createNodeMock: () => target });
        const instance = tree.getInstance();
        const spy1 = jest.spyOn(instance, 'unobserve');
        const spy2 = jest.spyOn(instance, 'observe');

        // none of the props updating
        tree.update(
            <IntersectionObserver {...initialProps}>
                <span />
            </IntersectionObserver>,
        );
        // only children updating
        tree.update(
            <IntersectionObserver {...initialProps}>
                <div />
            </IntersectionObserver>,
        );
        // only root updating (document)
        tree.update(
            <IntersectionObserver {...initialProps} root={root2}>
                <div />
            </IntersectionObserver>,
        );
        // only root updating (window)
        tree.update(
            <IntersectionObserver {...initialProps} root={root1}>
                <div />
            </IntersectionObserver>,
        );
        // only rootMargin updating
        tree.update(
            <IntersectionObserver {...initialProps} root={root1} rootMargin="20% 10%">
                <div />
            </IntersectionObserver>,
        );
        // only root updating (null)
        tree.update(
            <IntersectionObserver {...initialProps} rootMargin="20% 10%">
                <div />
            </IntersectionObserver>,
        );
        // only threshold updating (non-scalar)
        tree.update(
            <IntersectionObserver {...initialProps} threshold={[0.5, 1]}>
                <div />
            </IntersectionObserver>,
        );
        // only threshold updating (length changed)
        tree.update(
            <IntersectionObserver {...initialProps} threshold={[0, 0.25, 0.5, 0.75, 1]}>
                <div />
            </IntersectionObserver>,
        );
        // only threshold updating (scalar)
        tree.update(
            <IntersectionObserver {...initialProps} threshold={1}>
                <div />
            </IntersectionObserver>,
        );

        expect(spy1).toHaveBeenCalledTimes(6);
        expect(spy2).toHaveBeenCalledTimes(6);
    });

    test('should be defensive against unobserving nullified nodes', () => {
        const sizeAfterObserving = observerElementsMap.size + 1;
        const component = (
            <IntersectionObserver onChange={noop}>
                <span />
            </IntersectionObserver>
        );
        const tree = renderer.create(component, {
            createNodeMock: () => target,
        });
        tree.getInstance().target = null;
        tree.getInstance().unobserve();

        expect(observerElementsMap.size).toBe(sizeAfterObserving);
    });

    test('should not reobserve on a second render after root changed the first time', () => {
        const component = (
            <IntersectionObserver onChange={noop}>
                <span />
            </IntersectionObserver>
        );
        let called = false;
        const tree = renderer.create(component, {
            createNodeMock() {
                if (called) {
                    return target;
                }
                called = true;
                return Object.assign({ id: 2 }, target);
            },
        });
        const instance = tree.getInstance();
        const spy1 = jest.spyOn(instance, 'observe');
        const spy2 = jest.spyOn(instance, 'unobserve');

        tree.update(
            <IntersectionObserver onChange={noop}>
                <div />
            </IntersectionObserver>,
        );

        tree.update(
            <IntersectionObserver onChange={noop}>
                <div key="forcesRender" />
            </IntersectionObserver>,
        );

        expect(spy1).toHaveBeenCalledTimes(1);
        expect(spy2).toHaveBeenCalledTimes(1);
    });
});

describe('callback', () => {
    test('should call propType onChange for each of the changes', () => {
        const spy = jest.fn();
        const component = (
            <IntersectionObserver onChange={spy}>
                <span />
            </IntersectionObserver>
        );
        const target1 = Object.assign({ id: 1 }, target);
        const target2 = Object.assign({ id: 2 }, target);
        const instance = renderer.create(component, { createNodeMock: () => target1 }).getInstance();
        renderer.create(React.cloneElement(component), { createNodeMock: () => target2 });

        expect(observerElementsMap.size).toBe(1);

        const boundingClientRect = {};
        const intersectionRect = {};
        const entry1 = new IntersectionObserverEntry({
            target: target1,
            boundingClientRect,
            intersectionRect,
        });
        const entry2 = new IntersectionObserverEntry({
            target: target2,
            boundingClientRect,
            intersectionRect,
        });

        callback([entry1, entry2], instance.observer);

        expect(spy.mock.calls[0][0]).toBe(entry1);
        expect(spy.mock.calls[1][0]).toBe(entry2);
    });

    test('should call propType onEntry and onExit on node entry and exit', () => {
        const spy = jest.fn();
        const spyEntry = jest.fn();
        const spyExit = jest.fn();
        const component = (
            <IntersectionObserver onChange={spy} onEntry={spyEntry} onExit={spyExit} threshold={[0.25, 0.5, 0.75]}>
                <span />
            </IntersectionObserver>
        );
        const target1 = Object.assign({ id: 1 }, target);
        const instance = renderer.create(component, { createNodeMock: () => target1 }).getInstance();

        const boundingClientRect = { width: 1, height: 1 };
        const entry1 = new IntersectionObserverEntry({
            target: target1,
            boundingClientRect,
            intersectionRect: { width: 0.26, height: 1 },
        });
        const entry2 = new IntersectionObserverEntry({
            target: target1,
            boundingClientRect,
            intersectionRect: { width: 0.51, height: 1 },
        });
        const entry3 = new IntersectionObserverEntry({
            target: target1,
            boundingClientRect,
            intersectionRect: { width: 0.76, height: 1 },
        });
        const entry4 = new IntersectionObserverEntry({
            target: target1,
            boundingClientRect,
            intersectionRect: { width: 0.74, height: 1 },
        });
        const entry5 = new IntersectionObserverEntry({
            target: target1,
            boundingClientRect,
            intersectionRect: { width: 0.49, height: 1 },
        });
        const entry6 = new IntersectionObserverEntry({
            target: target1,
            boundingClientRect,
            intersectionRect: { width: 0.24, height: 1 },
        });

        callback([entry1, entry2, entry3, entry4, entry5, entry6], instance.observer);
        expect(spy).toHaveBeenCalledTimes(6);
        expect(spyEntry).toHaveBeenCalledTimes(1);
        expect(spyExit).toHaveBeenCalledTimes(1);
        expect(spyEntry.mock.calls[0][0]).toBe(entry1);
        expect(spyExit.mock.calls[0][0]).toBe(entry6);
    });
});

describe('handleChange', () => {
    test('should throw with `onlyOnce` if entry lacks `isIntersecting`', () => {
        global.spyOn(console, 'error'); // suppress deprecation warning
        const component = (
            <IntersectionObserver onChange={noop} onlyOnce={true}>
                <span />
            </IntersectionObserver>
        );
        const instance = renderer.create(component, { createNodeMock: () => target }).getInstance();
        const boundingClientRect = {};
        const intersectionRect = {};
        const entry = new IntersectionObserverEntry({
            target,
            boundingClientRect,
            intersectionRect,
        });
        delete entry.isIntersecting;

        expect(() => instance.handleChange(entry)).toThrowErrorMatchingSnapshot();
    });

    test('should unobserve with `onlyOnce` if `isIntersecting` is true', () => {
        global.spyOn(console, 'error'); // suppress deprecation warning
        const component = (
            <IntersectionObserver onChange={noop} onlyOnce={true}>
                <span />
            </IntersectionObserver>
        );
        const instance = renderer.create(component, { createNodeMock: () => target }).getInstance();
        const spy = jest.spyOn(instance, 'unobserve');
        const boundingClientRect = {};
        const intersectionRect = {};
        const entry = new IntersectionObserverEntry({
            target,
            boundingClientRect,
            intersectionRect,
        });
        entry.isIntersecting = true;

        instance.handleChange(entry);

        expect(spy).toBeCalled();
    });

    test('should not unobserve with `onlyOnce` if `isIntersecting` is false', () => {
        global.spyOn(console, 'error'); // suppress deprecation warning
        const component = (
            <IntersectionObserver onChange={noop} onlyOnce={true}>
                <span />
            </IntersectionObserver>
        );
        const instance = renderer.create(component, { createNodeMock: () => target }).getInstance();
        const spy = jest.spyOn(instance, 'unobserve');
        const boundingClientRect = {};
        const intersectionRect = {};
        const entry = new IntersectionObserverEntry({
            target,
            boundingClientRect,
            intersectionRect,
        });
        entry.isIntersecting = false;

        instance.handleChange(entry);

        expect(spy).not.toBeCalled();
    });

    test('should warn about the deprecation of `onlyOnce`', () => {
        const component = (
            <IntersectionObserver onChange={noop} onlyOnce={true}>
                <span />
            </IntersectionObserver>
        );
        const spy = global.spyOn(console, 'error');
        const instance = renderer.create(component, { createNodeMock: () => target }).getInstance();
        const boundingClientRect = {};
        const intersectionRect = {};
        const entry = new IntersectionObserverEntry({
            target,
            boundingClientRect,
            intersectionRect,
        });
        entry.isIntersecting = true;

        instance.handleChange(entry);

        expect(spy).toBeCalled();
        expect(spy.calls.first().args[0]).toContain('deprecation');
    });

    describe('disabled', () => {
        test('should not observe if disabled', () => {
            const component = (
                <IntersectionObserver onChange={noop} disabled={true}>
                    <span />
                </IntersectionObserver>
            );
            const sizeBefore = observerElementsMap.size;
            renderer.create(component, { createNodeMock: () => target });

            expect(observerElementsMap.size).toBe(sizeBefore);
        });

        test('should observe if not disabled', () => {
            const component = (
                <IntersectionObserver onChange={noop}>
                    <span />
                </IntersectionObserver>
            );
            const sizeAfterObserving = observerElementsMap.size + 1;
            renderer.create(component, { createNodeMock: () => target }).getInstance();

            expect(observerElementsMap.size).toBe(sizeAfterObserving);
        });

        test('should observe if no longer disabled', () => {
            const component = (
                <IntersectionObserver onChange={noop} disabled={true}>
                    <span />
                </IntersectionObserver>
            );
            const tree = renderer.create(component, { createNodeMock: () => target });
            const instance = tree.getInstance();
            const spy = jest.spyOn(instance, 'observe');

            tree.update(
                <IntersectionObserver onChange={noop}>
                    <span />
                </IntersectionObserver>,
            );

            expect(spy).toBeCalled();
        });

        test('should unobserve if disabled', () => {
            const component = (
                <IntersectionObserver onChange={noop}>
                    <span />
                </IntersectionObserver>
            );
            const tree = renderer.create(component, { createNodeMock: () => target });
            const instance = tree.getInstance();
            const spy1 = jest.spyOn(instance, 'unobserve');
            const spy2 = jest.spyOn(instance, 'observe');

            tree.update(
                <IntersectionObserver onChange={noop} disabled={true}>
                    <span />
                </IntersectionObserver>,
            );

            expect(spy1).toBeCalled();
            expect(spy2).not.toBeCalled();
        });
    });
});
