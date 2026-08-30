export function passwordVisibilityControl(isVisible: boolean) {
  const visibleLabel = isVisible ? '숨기기' : '보기';
  return {
    inputType: isVisible ? 'text' : 'password',
    visibleLabel,
    accessibleName: `비밀번호 ${visibleLabel}`,
  } as const;
}
