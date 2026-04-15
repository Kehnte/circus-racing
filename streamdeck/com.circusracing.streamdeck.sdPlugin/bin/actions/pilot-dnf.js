// pilot-dnf.ts — Toggle DNF for the pilot at this slot.
// Settings: { slotIndex: 0-4 }
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
import { action, SingletonAction } from "@elgato/streamdeck";
import { getSnapshot, onStateChange } from "../race-state.js";
import { onPageChange, getPilotAtSlot } from "../pilot-pager.js";
import { manualDnf } from "../api.js";
let PilotDnfAction = (() => {
    let _classDecorators = [action({ UUID: "com.circusracing.streamdeck.pilot-dnf" })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = SingletonAction;
    var PilotDnfAction = class extends _classSuper {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            PilotDnfAction = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        unsubState;
        unsubPage;
        lastEv;
        onWillAppear(ev) {
            this.lastEv = ev;
            this.unsubState = onStateChange(() => this.refresh());
            this.unsubPage = onPageChange(() => this.refresh());
            this.refresh();
        }
        onWillDisappear() {
            this.unsubState?.();
            this.unsubPage?.();
        }
        onDidReceiveSettings(ev) {
            this.lastEv = ev;
            this.refresh();
        }
        refresh() {
            const ev = this.lastEv;
            if (!ev)
                return;
            const snap = getSnapshot();
            const slot = ev.payload.settings.slotIndex ?? 0;
            const pilot = snap ? getPilotAtSlot(snap.pilots, slot) : null;
            const key = ev.action;
            if (!pilot) {
                void key.setTitle("—");
                void key.setState(1);
                return;
            }
            void key.setTitle(`${pilot.displayName}\nDNF`);
            void key.setState(pilot.status === "DNF" ? 0 : 1); // state 0 = red (active DNF)
        }
        async onKeyDown(ev) {
            const snap = getSnapshot();
            if (!snap)
                return;
            const slot = ev.payload.settings.slotIndex ?? 0;
            const pilot = getPilotAtSlot(snap.pilots, slot);
            if (!pilot)
                return;
            await manualDnf(snap.raceId, pilot.pilotId);
        }
    };
    return PilotDnfAction = _classThis;
})();
export { PilotDnfAction };
