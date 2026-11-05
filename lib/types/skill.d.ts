/** The bundled DSH skill uses single-line frontmatter; never maintain a second catalog summary. */
export declare function parseImageSkill(source: string): {
    name: string;
    description: string;
    whenToUse: string;
    content: string;
};
export declare function bundledImageSkill(): {
    path: string;
    source: string;
    invocation: {
        modelInvocable: boolean;
        userInvocable: boolean;
    };
    name: string;
    description: string;
    whenToUse: string;
    content: string;
};
