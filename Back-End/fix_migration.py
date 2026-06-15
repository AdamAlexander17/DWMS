import MySQLdb
import sys
conn = MySQLdb.connect(host='127.0.0.1', user='root', passwd='root', db='dwms')
c = conn.cursor()
c.execute("SELECT id, name FROM django_migrations WHERE app='roles' ORDER BY id")
rows = c.fetchall()
sys.stdout.write(f'Total roles migrations: {len(rows)}\n')
for row in rows:
    sys.stdout.write(f'  id={row[0]} name={row[1]}\n')
sys.stdout.flush()
c.close()
conn.close()
