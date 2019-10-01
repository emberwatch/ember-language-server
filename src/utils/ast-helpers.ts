import ASTPath from './../glimmer-utils';

function isFirstStringParamInCallExpression(path: ASTPath): boolean {
  return (
    isString(path.node) &&
    isCallExpression(path.parent) &&
    expressionHasArgument(path.parent, path.node, 0) &&
    path.parent.callee &&
    path.parent.callee.property
  );
}

export function isRouteLookup(astPath: ASTPath): boolean {
  return (
    isFirstStringParamInCallExpression(astPath) &&
    expressionHasIdentifierName(astPath.parent, [
      'transitionTo',
      'intermediateTransitionTo',
      'paramsFor',
      'transitionToRoute'
    ])
  );
}

export function isStoreModelLookup(path: ASTPath): boolean {
  return (
    isFirstStringParamInCallExpression(path) &&
    expressionHasIdentifierName(path.parent, [
      'findRecord',
      'createRecord',
      'findAll',
      'queryRecord',
      'peekAll',
      'query',
      'peekRecord',
      'adapterFor',
      'hasRecordForId'
    ])
  );
}

export function isComputedPropertyArgument(path: ASTPath): boolean {
  return (
    isString(path.node) &&
    isCallExpression(path.parent) &&
    expressionHasArgument(path.parent, path.node) &&
    expressionHasIdentifierName(path.parent, 'computed') &&
    !!path.parentPath &&
    hasNodeType(path.parentPath.parent, 'ObjectProperty')
  );
}

export function isTransformReference(path: ASTPath): boolean {
  return (
    isString(path.node) &&
    isCallExpression(path.parent) &&
    expressionHasArgument(path.parent, path.node, 0) &&
    expressionHasIdentifierName(path.parent, 'attr')
  );
}

export function isAngleComponentPath(path: ASTPath): boolean {
  return (
    hasNodeType(path.node, 'ElementNode') &&
    (path.node.tag.length === 0 ||
      path.node.tag.charAt(0) === path.node.tag.charAt(0).toUpperCase())
  );
}

export function isModifierPath(path: ASTPath): boolean {
  return (
    isPathExpression(path.node) &&
    !path.node.data &&
    hasNodeType(path.parent, 'ElementModifierStatement') &&
    path.node === path.parent.path
  );
}

export function isMustachePath(path: ASTPath): boolean {
  return (
    isPathExpression(path.node) &&
    hasNodeType(path.parent, 'MustacheStatement') &&
    path.parent.path === path.node
  );
}

export function isBlockPath(path: ASTPath): boolean {
  return (
    isPathExpression(path.node) &&
    isBlock(path.parent) &&
    path.parent.path === path.node
  );
}

export function isSubExpressionPath(path: ASTPath): boolean {
  return (
    isPathExpression(path.node) &&
    hasNodeType(path.parent, 'SubExpression') &&
    path.parent.path === path.node
  );
}

export function isLinkToTarget(path: ASTPath): boolean {
  return isInlineLinkToTarget(path) || isBlockLinkToTarget(path);
}

export function isInlineLinkToTarget(path: ASTPath): boolean {
  return (
    isString(path.node) &&
    hasNodeType(path.parent, 'MustacheStatement') &&
    path.parent.params[1] === path.node &&
    path.parent.path.original === 'link-to'
  );
}

export function isBlockLinkToTarget(path: ASTPath): boolean {
  return (
    isString(path.node) &&
    isBlock(path.parent) &&
    path.parent.params[0] === path.node &&
    path.parent.path.original === 'link-to'
  );
}

export function isImportPathDeclaration(path: ASTPath): boolean {
  return isString(path.node) && hasNodeType(path.parent, 'ImportDeclaration');
}

export function isServiceInjection(path: ASTPath): boolean {
  return (
    hasNodeType(path.node, 'Identifier') &&
    hasNodeType(path.parent, 'ObjectProperty') &&
    isCallExpression(path.parent.value) &&
    expressionHasIdentifierName(path.parent.value, 'service')
  );
}

export function isNamedServiceInjection(path: ASTPath): boolean {
  return (
    isString(path.node) &&
    isCallExpression(path.parent) &&
    expressionHasIdentifierName(path.parent, 'service')
  );
}

export function isModelReference(path: ASTPath): boolean {
  return (
    isString(path.node) &&
    isCallExpression(path.parent) &&
    expressionHasArgument(path.parent, path.node, 0) &&
    expressionHasIdentifierName(path.parent, ['belongsTo', 'hasMany'])
  );
}

function hasNodeType(node: any, type: string) {
  return node && node.type === type;
}

function isBlock(node: any): boolean {
  return hasNodeType(node, 'BlockStatement');
}

function isString(node: any): boolean {
  return hasNodeType(node, 'StringLiteral');
}

function isCallExpression(node: any): boolean {
  return hasNodeType(node, 'CallExpression');
}

function isPathExpression(node: any): boolean {
  return hasNodeType(node, 'PathExpression');
}

function expressionHasIdentifierName(exp: any, name: string | string[]) {
  const names = typeof name === 'string' ? [name] : name;
  let identifier = hasNodeType(exp.callee, 'Identifier')
    ? exp.callee
    : exp.callee.property;
  return names.includes(identifier.name);
}

function expressionHasArgument(exp: any, arg: any, position = -1) {
  if (!exp || !exp.arguments) {
    return false;
  }

  let index = exp.arguments.indexOf(arg);
  return index !== -1 && (position === -1 || position === index);
}
