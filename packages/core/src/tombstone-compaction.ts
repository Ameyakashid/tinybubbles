import type { Attachment, Project, Section, Task } from './types';

// Keep only conflict metadata plus neutral fields required by each entity schema.
export const compactPurgedTaskTombstone = (task: Task): Task => {
    if (!task.purgedAt) return task;
    return {
        id: task.id,
        title: '(deleted)',
        status: 'inbox',
        tags: [],
        contexts: [],
        rev: task.rev,
        revBy: task.revBy,
        createdAt: task.updatedAt,
        updatedAt: task.updatedAt,
        deletedAt: task.purgedAt,
        purgedAt: task.purgedAt,
    };
};

export const compactPurgedProjectTombstone = (project: Project): Project => {
    if (!project.purgedAt) return project;
    return {
        id: project.id,
        title: '(deleted)',
        status: 'active',
        color: '#6B7280',
        order: 0,
        tagIds: [],
        rev: project.rev,
        revBy: project.revBy,
        createdAt: project.updatedAt,
        updatedAt: project.updatedAt,
        deletedAt: project.purgedAt,
        purgedAt: project.purgedAt,
    };
};

export const compactPurgedProjectSectionTombstone = (
    section: Section,
    purgedAt: string,
): Section => ({
    id: section.id,
    projectId: section.projectId,
    title: '',
    order: 0,
    rev: section.rev,
    revBy: section.revBy,
    createdAt: purgedAt,
    updatedAt: purgedAt,
    deletedAt: purgedAt,
});

export const compactSectionsForPurgedProjects = (
    sections: readonly Section[],
    projects: readonly Project[],
): Section[] => {
    const purgedAtByProjectId = new Map(
        projects
            .filter((project): project is Project & { purgedAt: string } => Boolean(project.purgedAt))
            .map((project) => [project.id, project.purgedAt]),
    );
    return sections.map((section) => {
        const purgedAt = purgedAtByProjectId.get(section.projectId);
        return purgedAt ? compactPurgedProjectSectionTombstone(section, purgedAt) : section;
    });
};

export const compactAttachmentCleanupMetadata = (
    attachments: readonly Attachment[] | undefined,
): Attachment[] | undefined => {
    const files = attachments
        ?.filter((attachment) => attachment.kind === 'file' && attachment.uri)
        .map((attachment) => ({
            id: attachment.id,
            kind: attachment.kind,
            title: '',
            uri: attachment.uri,
            createdAt: attachment.createdAt,
            updatedAt: attachment.updatedAt,
        }));
    return files?.length ? files : undefined;
};

export const compactPurgedTaskForLocalStorage = (task: Task): Task => (
    task.purgedAt
        ? {
            ...compactPurgedTaskTombstone(task),
            attachments: compactAttachmentCleanupMetadata(task.attachments),
        }
        : task
);

export const compactPurgedProjectForLocalStorage = (project: Project): Project => (
    project.purgedAt
        ? {
            ...compactPurgedProjectTombstone(project),
            attachments: compactAttachmentCleanupMetadata(project.attachments),
        }
        : project
);

const hasValuesOutsideCompactedTombstone = (
    value: Record<string, unknown>,
    compacted: Record<string, unknown>,
): boolean => Object.entries(value).some(([key, item]) => (
    item !== undefined && JSON.stringify(item) !== JSON.stringify(compacted[key])
));

export const hasUncompactedPurgedTombstones = (
    data: { tasks: readonly Task[]; projects: readonly Project[]; sections: readonly Section[] },
): boolean => {
    if (data.tasks.some((task) => task.purgedAt && hasValuesOutsideCompactedTombstone(
        task as unknown as Record<string, unknown>,
        compactPurgedTaskTombstone(task) as unknown as Record<string, unknown>,
    ))) return true;
    if (data.projects.some((project) => project.purgedAt && hasValuesOutsideCompactedTombstone(
        project as unknown as Record<string, unknown>,
        compactPurgedProjectTombstone(project) as unknown as Record<string, unknown>,
    ))) return true;

    const compactSections = compactSectionsForPurgedProjects(data.sections, data.projects);
    return data.sections.some((section, index) => (
        section !== compactSections[index]
        && hasValuesOutsideCompactedTombstone(
            section as unknown as Record<string, unknown>,
            compactSections[index] as unknown as Record<string, unknown>,
        )
    ));
};
