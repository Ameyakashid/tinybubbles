import {
    runAttachmentTransferLifecycle,
    type AttachmentTransferLifecycleOptions,
} from '@tinybubbles/core';
import { createCooperativeYield, stripFileScheme } from './sync-service-utils';

export {
    collectAttachmentsById,
    getBaseSyncUrl,
    getCloudBaseUrl,
    normalizePendingRemoteDeletes,
    reportProgress,
    validateAttachmentHash,
} from '@tinybubbles/core';

type BasicRemoteAttachmentSyncOptions = Omit<
    AttachmentTransferLifecycleOptions,
    'beforeEachAttachment' | 'resolveLocalPath'
>;

export async function syncBasicRemoteAttachments(options: BasicRemoteAttachmentSyncOptions): Promise<boolean> {
    const maybeYield = createCooperativeYield(4);
    return await runAttachmentTransferLifecycle({
        ...options,
        beforeEachAttachment: maybeYield,
        resolveLocalPath: stripFileScheme,
    });
}
