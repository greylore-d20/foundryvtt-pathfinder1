export function dialogGetNumber({title="Input Number", initial=null, min=Number.NEGATIVE_INFINITY, max=Number.POSITIVE_INFINITY}={}) {
  return new Promise(resolve => {
    let cancelled = true;

    new Dialog({
      title: title,
      content: `<input type="number" name="result" min="${min}" max="${max}" value="${initial || 0}">`,
      buttons: {
        ok: {
          label: "Submit",
          callback: html => {
            cancelled = false;
            const input = html.find('input[name="result"]');
            resolve(input.val());
          },
        },
      },
      close: () => {
        if (!cancelled) {
          resolve(initial);
        }
      }
    }).render(true);
  });
};
