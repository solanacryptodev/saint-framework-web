import { Show, type JSX } from 'solid-js';
import './GeneralModal.css';

export interface GeneralModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    modalType: 'player-creation' | 'inventory' | 'settings' | string;
    children: JSX.Element;
    footerActions?: JSX.Element;
}

export default function GeneralModal(props: GeneralModalProps) {
    /** Close only when clicking backdrop (not the modal itself) */
    function handleBackdropClick() {
        props.onClose();
    }

    return (
        <Show when={props.isOpen}>
            {/* Backdrop */}
            <div class="general-modal-backdrop" onClick={handleBackdropClick} />

            {/* Centering wrapper */}
            <div class="general-modal-wrapper">
                <div
                    class="general-modal"
                    data-modal-type={props.modalType}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div class="general-modal-header">
                        <span class="general-modal-title">
                            <span class="diamond-icon">◆</span>
                            {props.title}
                        </span>
                        <button class="general-modal-close" onClick={() => props.onClose()}>
                            ✕
                        </button>
                    </div>

                    {/* Body — contents driven by modalType */}
                    <div class="general-modal-body">
                        {props.children}
                    </div>

                    {/* Footer (optional) */}
                    <Show when={props.footerActions}>
                        <div class="general-modal-footer">
                            {props.footerActions}
                        </div>
                    </Show>
                </div>
            </div>
        </Show>
    );
}
