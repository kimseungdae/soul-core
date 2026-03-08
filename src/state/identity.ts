export interface Role {
  id: string;
  label: string;
  salience: number;
  active: boolean;
}

export interface IdentityLayer {
  name: string;
  selfConcept: string;
  roles: Role[];
  groupAffiliations: string[];
}

export function createDefaultIdentityLayer(): IdentityLayer {
  return {
    name: "",
    selfConcept: "",
    roles: [],
    groupAffiliations: [],
  };
}
