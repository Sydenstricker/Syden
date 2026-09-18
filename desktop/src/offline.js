const target = new URLSearchParams(location.search).get('url');
document.getElementById('retry').addEventListener('click', () => {
  if (target) location.href = target;
});
