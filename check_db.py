import sqlite3

def check():
    conn = sqlite3.connect('stocks.db')
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    for table in tables:
        table_name = table[0]
        cursor.execute(f"PRAGMA table_info({table_name});")
        print(f"Table: {table_name}")
        for col in cursor.fetchall():
            print(f"  {col}")

if __name__ == '__main__':
    check()
