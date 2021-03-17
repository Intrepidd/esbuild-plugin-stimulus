import type { Plugin } from 'esbuild';
import * as path from 'path';
import { readdir } from 'fs';
import { promisify } from 'util';

export const stimulusPlugin: Plugin = {
  name: 'stimulus',
  setup(build) {
    const namespace = 'stimulus_ns';

    build.onResolve({ filter: /^stimulus:./ }, args => {
      const pathArg = args.path.substr('stimulus:'.length);
      return {
        path: path.join(args.resolveDir, pathArg.replace(/\//g, path.sep)),
        namespace,
      };
    });

    build.onLoad({ filter: /.*/, namespace }, async (args) => {
      interface Controller {
        controllerName: string;
        modulePath: string;
      }
      const walk = async (dir: string, prefix: string, moduleDir: string): Promise<Controller[]> => {
        let files;
        try {
          files = await promisify(readdir)(dir, {withFileTypes: true});
        } catch {
          // Does not exist. Return empty list.
          return [];
        }
        let result = [];
        for (const ent of files) {
          if (ent.isDirectory()) {
            result.push(...await walk(
              path.join(dir, ent.name),
              ent.name + '--',
              moduleDir + '/' + ent.name,
            ));
            continue;
          }
          if (ent.name.endsWith('_controller.ts') || ent.name.endsWith('_controller.js')) {
            const controllerName = prefix + ent.name
              .substr(0, ent.name.length - '_controller.js'.length)
              .replace(/_/g, '-');
            const moduleName = ent.name.substr(0, ent.name.length - '.js'.length);
            result.push({
              controllerName,
              modulePath: moduleDir + '/' + moduleName,
            });
          }
        }
        return result;
      };
      const controllers = await walk(args.path, '', '.');
      let contents = '';
      for (let i = 0; i < controllers.length; i++) {
        const { modulePath } = controllers[i];
        contents += `import c${i} from '${modulePath}';\n`;
      }
      contents += 'export const definitions = [\n';
      for (let i = 0; i < controllers.length; i++) {
        const { controllerName } = controllers[i];
        contents += `\t{identifier: '${controllerName}', controllerConstructor: c${i}},\n`;
      }
      contents += '];\n';
      return {
        contents,
        loader: 'js',
        resolveDir: args.path,
      };
    });
  },
};
