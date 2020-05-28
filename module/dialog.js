export function dialogGetNumber({title="Input Number", initial=null, min=Number.NEGATIVE_INFINITY, max=Number.POSITIVE_INFINITY}={}) {
  return new Promise(resolve => {
    new Dialog({
      title: title,
      content: `<input type="number" name="result" min="${min}" max="${max}" value="${initial || 0}">`,
      buttons: {
        ok: {
          label: "Submit",
          callback: html => {
            const input = html.find('input[name="result"]');
            resolve(input.val());
          },
        },
      },
      close: () => {
        resolve(initial);
      }
    }).render(true);
  });
};
