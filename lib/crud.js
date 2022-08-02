'use strict';

module.exports = (init) => {
  const iface = {};
  const { entities, endpoint } = init;
  const names = Object.keys(entities);
  const channels = new Map(names.map((val) => [val, new Set()]));
  const { model } = application.schemas;
  const returinings = {};

  for (const [entity, methods] of Object.entries(entities)) {
    const channel = channels.get(entity);
    const schema = model.entities.get(entity);
    const keys = returinings[entity] = Object.keys(schema.fields);
    const manys = [];
    const ones = [];
    keys.forEach((key) => {
      const { one, many } = schema.fields[key];
      if (one) ones.push({ [key]: one });
      if (many) manys.push({ [key]: many });
    });

    if (methods.includes('schema')) {
      iface['schema' + entity] = (context) => async () => schema.toJSON();
    }

    if (methods.includes('subscribe')) {
      iface['subscribe' + entity] = (context) => async () => {
        const { client } = context;
        channel.add(client);
        client.on('close', () => {
          channel.delete(client);
        });
        return 'ok';
      };
      iface['unsubscribe' + entity] = (context) => async () => {
        const { client } = context;
        channel.delete(client);
        return 'ok';
      };
    }

    if (methods.includes('create')) {
      iface['create' + entity] = (context) => async (record) => {
        const { rows: result } = await db.pg
          .insert(entity, record)
          .returning(returinings[entity]);
        channel.forEach((client) =>
          client.emit(`${endpoint}/${entity}`, { status: 'created', result }),
        );
        return result;
      };
    }

    if (methods.includes('get')) {
      iface['get' + entity] =
        (context) =>
          async ({ conditions }) => {
            const result = await db.pg.row(entity, ...conditions);
            if (ones.length > 0) {
              for (const one of ones) {
                for (const [field, table] of Object.entries(one)) {
                  const { toLowerCamel } = metarhia.metautil;
                  const tableIdName = toLowerCamel(table) + 'Id';
                  const id = result[field + 'Id'];
                  result[field] = await db.pg.row(table, { [tableIdName]: id });
                }
              }
            }
            return result;
          };
    }

    if (methods.includes('select')) {
      iface['select' + entity] =
        (context) =>
          async ({ fields, conditions }) => {
            const result = await db.pg.select(entity, fields, ...conditions);
            for (const row of result) {
              if (ones.length > 0) {
                for (const one of ones) {
                  for (const [field, table] of Object.entries(one)) {
                    const { toLowerCamel } = metarhia.metautil;
                    const tableIdName = toLowerCamel(table) + 'Id';
                    const id = row[field + 'Id'];
                    row[field] = await db.pg.row(table, { [tableIdName]: id });
                  }
                }
              }
            }
            return result;
          };
    }

    if (methods.includes('update')) {
      iface['update' + entity] =
        (context) =>
          async ({ delta, conditions }) => {
            const { rows: result } = await db.pg
              .update(entity, delta, ...conditions)
              .returning(returinings[entity]);
            channel.forEach((client) =>
              client.emit(`${endpoint}/${entity}`, {
                status: 'updated',
                result,
              }),
            );
            return result;
          };
    }

    if (methods.includes('delete')) {
      iface['delete' + entity] =
        (context) =>
          async ({ conditions }) => {
            const { rows: result } = await db.pg
              .delete(entity, ...conditions)
              .returning(returinings[entity]);
            channel.forEach((client) =>
              client.emit(`${endpoint}/${entity}`, {
                status: 'deleted',
                result,
              }),
            );
            return result;
          };
    }
  }
  return iface;
};
